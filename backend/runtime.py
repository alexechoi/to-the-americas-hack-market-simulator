"""Singleton exchange runtime: owns the Exchange, drives the tick loop, broadcasts via SSE.

The SSE stream multiplexes two event types onto one connection:
    * ``snapshot`` — full ladder/fair/recent_trades, fired every UI tick.
    * ``trade_log`` — one entry per *fill* (i.e. an actual trade), fired as soon
      as the exchange produces it. Carries reasoning when the fill came from a
      swarm agent; manual orders submitted via HTTP land here without reasoning.

Trade-log entries are buffered in a small rolling deque so a late-joining
subscriber sees the recent history immediately instead of an empty panel.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Any, AsyncIterator

from agents.schemas import TraderDecision, TraderPersona
from exchange import Exchange, MMParams
from exchange.types import Fill, Snapshot
from news import NewsBus

logger = logging.getLogger(__name__)

# Cadence configuration — keep here so it's tweakable in one place.
UI_TICK_PERIOD_S = 0.2  # 5 Hz salt re-roll / breathing
EVENT_TICK_EVERY = 5  # every Nth UI tick advances an event tick (=> 1 Hz event ticks)

# How many recent trade-log entries to retain for late SSE joiners. Bigger means
# late panels render with more history; small enough to never be a memory concern.
TRADE_LOG_BUFFER = 100

# How many pending intents we hold per agent waiting to be matched to a fill.
# An HFT can submit several orders before any of them clears — but if more than
# this many pile up, the oldest is dropped (probably a killed order whose fill
# never arrived). Bounded so memory can't grow unboundedly on misbehaving agents.
PENDING_INTENT_PER_AGENT = 8


def _serialize_snapshot(snap: Snapshot) -> dict[str, Any]:
    """Convert a Snapshot dataclass to a JSON-friendly dict."""
    return {
        "tick_id": snap.tick_id,
        "event_tick": snap.event_tick,
        "fair": snap.fair,
        "best_bid": snap.best_bid,
        "best_ask": snap.best_ask,
        "mid": snap.mid,
        "ladder": {
            "bids": [{"price": p, "size": s} for p, s in snap.ladder.bids],
            "asks": [{"price": p, "size": s} for p, s in snap.ladder.asks],
        },
        "recent_trades": [
            {
                "agent_id": f.agent_id,
                "qty": f.qty,
                "vwap": f.vwap,
                "levels": [{"price": p, "size": s} for p, s in f.levels],
            }
            for f in snap.recent_trades
        ],
    }


def _serialize_trade_log_entry(
    fill: Fill,
    *,
    persona: TraderPersona | None,
    reasoning: str | None,
) -> dict[str, Any]:
    """Project a Fill (plus optional persona/reasoning) into the wire shape.

    Field names are camelCase to match the existing frontend ``TradeLogEntry``
    type — keep aligned with frontend/app/lib/sim/types.ts.

    For agent-submitted trades, ``persona`` and ``reasoning`` are populated.
    For manual trades (HTTP /exchange/orders), both are ``None`` and the
    consumer should render the agent_id verbatim with no reasoning blurb.
    """
    ts_ms = int(time.time() * 1000)
    side = "buy" if fill.qty > 0 else "sell"
    return {
        "id": f"{fill.agent_id}-{ts_ms}",
        "agentId": fill.agent_id,
        "agentName": persona.display_name if persona else None,
        "archetype": persona.archetype.value if persona else None,
        "side": side,
        "size": abs(fill.qty),
        "price": fill.vwap,
        "reasoning": reasoning,
        "ts": ts_ms,
    }


class _PendingIntent:
    """One per-submit record kept until the matching fill arrives."""

    __slots__ = ("persona", "reasoning")

    def __init__(self, persona: TraderPersona, reasoning: str) -> None:
        self.persona = persona
        self.reasoning = reasoning


class ExchangeRuntime:
    """
    Single shared Exchange instance plus a background async task that ticks it
    and fans out snapshots and trade-log entries to any number of SSE subscribers.

    The trade log is the canonical "what just happened" stream — every fill the
    exchange produces (agent-driven or manual) is broadcast as a ``trade_log``
    SSE event. Reasoning is attached when the runtime has a matching pending
    intent for the agent_id; otherwise the entry is reasoning-less.
    """

    def __init__(
        self, params: MMParams | None = None, initial_fair: float = 100.0
    ) -> None:
        self.exchange = Exchange(params=params or MMParams(), initial_fair=initial_fair)
        # News is part of the simulation, not a separate service — same ownership
        # boundary as the ladder. Agents and HTTP handlers read via `runtime.news_bus`.
        self.news_bus = NewsBus(self.exchange)
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._trade_log: deque[dict[str, Any]] = deque(maxlen=TRADE_LOG_BUFFER)
        # Per-agent FIFO of (persona, reasoning) waiting to be matched to a fill.
        # Pushed by record_intent at submit time, popped by _emit_fill on the
        # next tick that produces a fill for that agent.
        self._pending_intents: dict[str, deque[_PendingIntent]] = {}
        self._task: asyncio.Task[None] | None = None
        self._counter = 0

    # ---- lifecycle ----

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run(), name="exchange-tick-loop")
            logger.info("Exchange tick loop started")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
            logger.info("Exchange tick loop stopped")

    # ---- subscribers ----

    def _subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        # Queue size 64 because we multiplex two event types on one queue:
        # snapshot ticks (5 Hz) plus bursty trade_log entries.
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
        # Prime with the current state so the client doesn't have to wait a full tick.
        try:
            q.put_nowait(
                {
                    "event": "snapshot",
                    "data": _serialize_snapshot(self.exchange.snapshot()),
                }
            )
        except asyncio.QueueFull:
            pass
        # Replay the rolling buffer of recent trades (oldest first) so a late
        # joiner doesn't see an empty TradeLog panel.
        for entry in self._trade_log:
            try:
                q.put_nowait({"event": "trade_log", "data": entry})
            except asyncio.QueueFull:
                break
        self._subscribers.add(q)
        return q

    def _unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(q)

    async def stream(self) -> AsyncIterator[dict[str, Any]]:
        """Async generator yielding ``{"event", "data"}`` envelopes per fan-out item."""
        q = self._subscribe()
        try:
            while True:
                yield await q.get()
        finally:
            self._unsubscribe(q)

    def _broadcast(self, envelope: dict[str, Any]) -> None:
        # Drop messages on slow consumers rather than blocking the tick loop.
        for q in list(self._subscribers):
            try:
                q.put_nowait(envelope)
            except asyncio.QueueFull:
                # Slow consumer — drop oldest, push newest, so they catch up to current state.
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(envelope)
                except asyncio.QueueFull:
                    pass

    # ---- trade log ----

    def record_intent(self, persona: TraderPersona, decision: TraderDecision) -> None:
        """Remember an agent's decision so its eventual fill can carry reasoning.

        Called by the swarm right before submitting an order. HOLDs should not
        call this — they don't produce a fill. The intent sits in a per-agent
        FIFO until ``_emit_fill`` pops it and attaches it to the fill envelope.
        Bounded per agent so a misbehaving / always-killed agent can't leak.
        """
        bucket = self._pending_intents.setdefault(
            persona.agent_id, deque(maxlen=PENDING_INTENT_PER_AGENT)
        )
        bucket.append(_PendingIntent(persona=persona, reasoning=decision.reasoning))

    def log_fill(self, fill: Fill) -> None:
        """Public entry point for emitting a single fill to the trade log.

        For agent fills the runtime pops the matching intent FIFO automatically.
        For manual fills (no prior ``record_intent``) the entry is rendered with
        ``agentName=None`` / ``reasoning=None`` so the UI shows just the trade.
        Idempotent against the rolling buffer.
        """
        self._emit_fill(fill)

    def _emit_fill(self, fill: Fill) -> None:
        bucket = self._pending_intents.get(fill.agent_id)
        intent = bucket.popleft() if bucket else None
        entry = _serialize_trade_log_entry(
            fill,
            persona=intent.persona if intent else None,
            reasoning=intent.reasoning if intent else None,
        )
        self._trade_log.append(entry)
        self._broadcast({"event": "trade_log", "data": entry})

    # ---- tick loop ----

    async def _run(self) -> None:
        try:
            while True:
                self._counter += 1
                advance_event = self._counter % EVENT_TICK_EVERY == 0
                snap = self.exchange.tick(advance_event=advance_event)
                # Emit a trade_log entry for every fill produced by this tick,
                # in execution order. Snapshots come *after* the fills so the
                # UI can update its tape before the post-fill ladder snaps in.
                for fill in self.exchange.last_tick_fills:
                    self._emit_fill(fill)
                self._broadcast(
                    {"event": "snapshot", "data": _serialize_snapshot(snap)}
                )
                await asyncio.sleep(UI_TICK_PERIOD_S)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Exchange tick loop crashed")
            raise


# Module-level singleton — single shared simulation per backend process.
runtime = ExchangeRuntime()
