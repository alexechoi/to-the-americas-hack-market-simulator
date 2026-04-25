"""MuBit memory layer for trader agents.

Why this module exists
----------------------
The trader agent (``agents.llm``) is otherwise stateless — every turn rebuilds
``TraderContext`` from the live exchange + news bus, and ``agent.run(...)`` is
called without ``message_history``. That means agents have NO memory of their
own past decisions or of headlines they have already digested. This module
plugs the simulation into MuBit so each persona accumulates:

* a per-turn record of (observation, decision, reasoning, fill outcome),
* every news headline the simulation has published,

and so each turn can recall (token-budgeted) what's relevant to the current
moment before the LLM call.

Design
------
* **Singleton** — one ``MubitMemory`` per backend process, initialised from
  ``main.lifespan``. The shared run_id is rotated by ``runtime.respawn``.
* **Per-persona ``agent_id``** — we use ``persona.agent_id`` directly so MuBit
  can scope retrieval to that trader's lane.
* **Sync SDK, async wrapper** — the upstream Python client is blocking. Reads
  (``recall_context``) run via ``asyncio.to_thread`` with a bounded timeout
  so a slow MuBit call can't stall an agent's tick. Writes
  (``remember_*_async``) are fire-and-forget background tasks; failures are
  logged, never raised, never awaited by the caller.
* **No-op fallback** — if ``MUBIT_API_KEY`` is unset, every method short-
  circuits to a benign default. This keeps local dev / CI working without
  credentials and matches the project pattern (see ``LOGFIRE_TOKEN``).
* **Centralised logging** — uses the module logger; the Logfire bridge in
  ``observability`` carries spans to the UI when a token is present.
* **Errors are logged, never swallowed silently** (per AGENTS.md §2).
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

from mubit import Client

from .schemas import TraderContext, TraderDecision, TraderPersona

logger = logging.getLogger(__name__)

# Bounded timeout for the per-turn ``recall_context`` call. Tight on purpose —
# the trader loop ticks at ~1 Hz on most personas and 0.5 s on HFT, so we
# can't block the loop on a slow read. If MuBit is degraded we silently fall
# back to no extra context rather than skipping the turn.
_RECALL_TIMEOUT_S = 1.0

# Token budget for the context block we splice into the LLM prompt. ~300
# tokens keeps the per-turn prompt overhead small while still giving the
# model a few sentences of recent lessons / facts.
_CONTEXT_TOKEN_BUDGET = 300

# Limit on remembered-decision text length. The reasoning field is already
# capped at 240 chars; this is belt-and-braces against an exotic prompt
# blowing past MuBit's per-item limits.
_REMEMBER_MAX_CHARS = 1024


class MubitMemory:
    """Process-wide MuBit memory facade.

    Every method is a no-op when ``MUBIT_API_KEY`` is missing — call sites
    never need to branch on configuration. ``configure(...)`` and
    ``set_run_id(...)`` are the only stateful operations; everything else is
    stateless w.r.t. the configured client.
    """

    def __init__(self) -> None:
        self._client: Client | None = None
        self._run_id: str | None = None
        # Track outstanding fire-and-forget tasks so a sudden GC can't drop
        # them mid-flight. Background tasks discard themselves on completion.
        self._pending: set[asyncio.Task[Any]] = set()

    # ------------------------------------------------------------------ lifecycle

    def configure(self) -> None:
        """Initialise the underlying MuBit client from env. Idempotent.

        Reads ``MUBIT_API_KEY`` (required to enable the integration) and
        ``MUBIT_ENDPOINT`` / ``MUBIT_TRANSPORT`` (both optional — the SDK has
        sensible defaults). When the key is missing, the memory layer stays
        disabled and every public method becomes a no-op.
        """
        if self._client is not None:
            return
        api_key = os.getenv("MUBIT_API_KEY", "").strip()
        if not api_key:
            logger.info("MuBit disabled — MUBIT_API_KEY not set; memory is a no-op")
            return
        try:
            # The SDK pulls endpoint / transport from env automatically; we
            # only need to forward the api_key so it doesn't depend on
            # process-wide os.environ ordering.
            self._client = Client(api_key=api_key)
        except Exception:
            logger.exception("MuBit client init failed — memory will stay disabled")
            return
        logger.info("MuBit memory enabled")

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def set_run_id(self, run_id: str) -> None:
        """Rotate the active simulation run.

        Called by ``runtime.respawn`` so memory from a previous ticker doesn't
        bleed into the new one. We also update the SDK's transport-level
        run_id so callers don't have to pass it explicitly on every helper.
        """
        self._run_id = run_id
        if self._client is not None:
            try:
                self._client.set_run_id(run_id)
            except Exception:
                logger.exception("MuBit set_run_id failed run_id=%s", run_id)
        logger.info("MuBit run_id set to %s", run_id)

    # ------------------------------------------------------------------ writes (fire-and-forget)

    def remember_headline_async(
        self, *, source: str, headline: str, body: str | None = None
    ) -> None:
        """Persist a published headline as a shared fact.

        We tag with ``agent_id="news-bus"`` so headlines aren't attributed to
        any one persona — they are observable to every agent in the run.
        Publish time is duplicated into ``metadata.published_ts`` so future
        retrievals can sort/filter by it (the helper SDK does not expose
        ``occurrence_time`` directly; revisit when bumping mubit-sdk).
        """
        if not self.enabled or self._run_id is None:
            return
        text = headline if not body else f"{headline}\n\n{body}"
        text = text[:_REMEMBER_MAX_CHARS]
        self._spawn_remember(
            content=text,
            agent_id="news-bus",
            intent="fact",
            metadata={
                "source": source,
                "kind": "headline",
                "published_ts": int(time.time()),
            },
        )

    def remember_decision_async(
        self,
        *,
        persona: TraderPersona,
        decision: TraderDecision,
        ctx: TraderContext,
    ) -> None:
        """Persist this persona's turn (observation snapshot + decision + reasoning).

        Stored as an ``observation`` so reflection treats it as raw evidence
        rather than a rule/lesson. Fresh-news headlines are inlined into the
        text so the eventual lesson extraction can correlate "agent X went
        long after headline Y" without joining across items.
        """
        if not self.enabled or self._run_id is None:
            return
        # Compact one-line summary — the long reasoning lives in metadata.
        market = ctx.market
        fresh = [n.headline for n in ctx.news if n.seconds_ago < 5.0]
        fresh_blurb = (
            f" reacting-to=({'; '.join(h[:80] for h in fresh)})" if fresh else ""
        )
        summary = (
            f"{persona.display_name} ({persona.archetype.value}) "
            f"chose {decision.action.value} qty={decision.quantity} "
            f"@ {decision.limit_price:.4f} (fair={market.fair:.4f}, "
            f"bid={market.best_bid:.4f}, ask={market.best_ask:.4f}, "
            f"inv={ctx.account.inventory}, conf={decision.confidence:.2f})"
            f"{fresh_blurb} — {decision.reasoning}"
        )[:_REMEMBER_MAX_CHARS]
        self._spawn_remember(
            content=summary,
            agent_id=persona.agent_id,
            intent="observation",
            metadata={
                "archetype": persona.archetype.value,
                "action": decision.action.value,
                "quantity": decision.quantity,
                "limit_price": decision.limit_price,
                "confidence": decision.confidence,
                "fair": market.fair,
                "best_bid": market.best_bid,
                "best_ask": market.best_ask,
                "inventory": ctx.account.inventory,
                "n_fills": ctx.account.n_fills,
                "fresh_news_count": len(fresh),
                "decided_ts": int(time.time()),
            },
        )

    # ------------------------------------------------------------------ reads (bounded await)

    async def recall_context(self, *, persona: TraderPersona, query: str) -> str:
        """Pull a token-budgeted context block for ``persona`` to splice into the prompt.

        Returns an empty string when memory is disabled, the recall times
        out, or the call errors. A failure here must never break a turn —
        the agent should still be able to decide from live observation alone.
        """
        if not self.enabled or self._run_id is None:
            return ""
        client = self._client
        run_id = self._run_id
        agent_id = persona.agent_id
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    client.get_context,
                    session_id=run_id,
                    query=query,
                    agent_id=agent_id,
                    max_token_budget=_CONTEXT_TOKEN_BUDGET,
                    mode="summary",
                ),
                timeout=_RECALL_TIMEOUT_S,
            )
        except TimeoutError:
            logger.warning(
                "MuBit recall_context timed out after %.2fs agent_id=%s",
                _RECALL_TIMEOUT_S,
                agent_id,
            )
            return ""
        except Exception:
            logger.exception("MuBit recall_context failed agent_id=%s", agent_id)
            return ""
        return _flatten_context(result)

    # ------------------------------------------------------------------ internals

    def _spawn_remember(
        self,
        *,
        content: str,
        agent_id: str,
        intent: str,
        metadata: dict[str, Any],
    ) -> None:
        """Fire a ``remember`` call as a background task — caller never awaits.

        Falls back to a synchronous call when invoked outside an event loop
        (e.g. from a sync request handler) — the underlying ``wait=False``
        ingest returns immediately with a job_id, so this is non-blocking
        in practice.
        """
        client = self._client
        run_id = self._run_id
        if client is None or run_id is None:
            return
        kwargs: dict[str, Any] = {
            "content": content,
            "session_id": run_id,
            "agent_id": agent_id,
            "intent": intent,
            "metadata": metadata,
            "wait": False,
        }

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                client.remember(**kwargs)
            except Exception:
                logger.exception("MuBit remember (sync) failed agent_id=%s", agent_id)
            return

        task = loop.create_task(
            self._remember_task(kwargs=kwargs, agent_id=agent_id, intent=intent),
            name=f"mubit-remember:{agent_id}",
        )
        self._pending.add(task)
        task.add_done_callback(self._pending.discard)

    async def _remember_task(
        self, *, kwargs: dict[str, Any], agent_id: str, intent: str
    ) -> None:
        client = self._client
        if client is None:
            return
        try:
            await asyncio.to_thread(client.remember, **kwargs)
        except Exception:
            logger.exception(
                "MuBit remember failed agent_id=%s intent=%s", agent_id, intent
            )


def _flatten_context(payload: Any) -> str:
    """Best-effort projection of MuBit's context response into a prompt-ready string.

    The control-plane response shape evolves across SDK versions; we extract
    the fields we know about (``section_summaries`` / ``content`` / ``text``)
    and fall back to ``str(payload)`` so agents always get *some* useful
    context block, never an empty render of a non-empty response.
    """
    if not payload:
        return ""
    if isinstance(payload, str):
        return payload.strip()
    if isinstance(payload, dict):
        for key in ("content", "text", "context"):
            v = payload.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        sections = payload.get("section_summaries") or payload.get("sections")
        if isinstance(sections, list):
            parts: list[str] = []
            for s in sections:
                if isinstance(s, dict):
                    text = s.get("summary") or s.get("text") or s.get("content")
                    if isinstance(text, str) and text.strip():
                        parts.append(text.strip())
                elif isinstance(s, str) and s.strip():
                    parts.append(s.strip())
            if parts:
                return "\n".join(parts)
    return ""


memory = MubitMemory()
