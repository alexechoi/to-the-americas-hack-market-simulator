"""Singleton exchange runtime: owns the Exchange, drives the tick loop, broadcasts via SSE.

The SSE stream multiplexes three event types onto one connection:
    * ``snapshot`` — full ladder/fair/recent_trades, fired every UI tick.
    * ``order_log`` — one entry per *decision*, fired the moment the swarm or a
      human submits one. Covers BUY, SELL, **HOLD**, and manual orders. Agent
      decisions carry reasoning + confidence; manual orders submitted via HTTP
      land here with ``source="manual"`` and no reasoning.
    * ``reset`` — fired whenever the simulation is (re)bootstrapped around a
      new ticker. Carries ``{ticker, name, fair, fetched_at}``. The frontend
      drops chart/timeline buffers and updates its instrument header. Also
      primed once on every new SSE connection so a late joiner learns the
      current ticker without an extra HTTP round-trip.

Order-log entries are buffered in a small rolling deque so a late-joining
subscriber sees the recent history immediately instead of an empty panel.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Any, AsyncIterator, Iterable
from uuid import uuid4

from agents.schemas import TraderDecision, TraderPersona
from bootstrap import BootstrapPayload
from exchange import Exchange, MMParams
from exchange.types import Order, Snapshot
from news import NewsBus

logger = logging.getLogger(__name__)

# Cadence configuration — keep here so it's tweakable in one place.
UI_TICK_PERIOD_S = 0.2  # 5 Hz salt re-roll / breathing
EVENT_TICK_EVERY = 5  # every Nth UI tick advances an event tick (=> 1 Hz event ticks)

# How many recent order-log entries to retain for late SSE joiners. Bigger means
# late panels render with more history; small enough to never be a memory concern.
ORDER_LOG_BUFFER = 200


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


def _serialize_agent_decision(
    persona: TraderPersona, decision: TraderDecision
) -> dict[str, Any]:
    """Project a TraderDecision (plus its persona) into the wire shape.

    Field names are camelCase to match the frontend ``OrderLogEntry`` type —
    keep aligned with frontend/app/lib/exchange/types.ts.
    """
    ts_ms = int(time.time() * 1000)
    return {
        "id": f"{persona.agent_id}-{ts_ms}-{uuid4().hex[:6]}",
        "agentId": persona.agent_id,
        "agentName": persona.display_name,
        "archetype": persona.archetype.value,
        "action": decision.action.value,
        "quantity": decision.quantity,
        "limitPrice": decision.limit_price,
        "confidence": decision.confidence,
        "reasoning": decision.reasoning,
        "ts": ts_ms,
        "source": "agent",
    }


def _serialize_manual_order(order: Order) -> dict[str, Any]:
    """Project a manual ``/exchange/orders`` submission into the wire shape.

    Manual orders carry no persona/reasoning — the consumer renders them as a
    bare trade line with a ``MANUAL`` tag instead of an archetype label.
    """
    ts_ms = int(time.time() * 1000)
    if order.qty > 0:
        action = "buy"
    elif order.qty < 0:
        action = "sell"
    else:
        action = "hold"
    return {
        "id": f"{order.agent_id}-{ts_ms}-{uuid4().hex[:6]}",
        "agentId": order.agent_id,
        "agentName": None,
        "archetype": None,
        "action": action,
        "quantity": abs(order.qty),
        "limitPrice": order.limit,
        "confidence": None,
        "reasoning": None,
        "ts": ts_ms,
        "source": "manual",
    }


class ExchangeRuntime:
    """
    Single shared Exchange instance plus a background async task that ticks it
    and fans out snapshots and order-log entries to any number of SSE subscribers.

    The order log is the canonical "what just got decided" stream — every LLM
    decision (BUY/SELL/HOLD) and every manual submission lands here as an
    ``order_log`` SSE event. Reasoning is attached for agent decisions; manual
    entries render with no reasoning.
    """

    def __init__(
        self,
        params: MMParams | None = None,
        initial_fair: float = 100.0,
        *,
        ticker: str = "NVDA",
        ticker_name: str = "NVIDIA Corp",
    ) -> None:
        self._params = params or MMParams()
        self.exchange = Exchange(params=self._params, initial_fair=initial_fair)
        # News is part of the simulation, not a separate service — same ownership
        # boundary as the ladder. Agents and HTTP handlers read via `runtime.news_bus`.
        self.news_bus = NewsBus(self.exchange)
        # Ticker context — purely a label on the runtime; the Exchange engine
        # itself stays single-asset / ticker-agnostic. Refreshed on respawn.
        self.ticker = ticker
        self.ticker_name = ticker_name
        self.fetched_at: str | None = None
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._order_log: deque[dict[str, Any]] = deque(maxlen=ORDER_LOG_BUFFER)
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

    # ---- ticker / state ----

    def state_payload(self) -> dict[str, Any]:
        """The shape carried by both ``GET /exchange/state`` and the ``reset`` event.

        Kept here so the HTTP route and the SSE prime/respawn broadcasts can't
        drift apart on field names.
        """
        return {
            "ticker": self.ticker,
            "name": self.ticker_name,
            "fair": self.exchange.state.fair,
            "fetched_at": self.fetched_at,
        }

    # ---- subscribers ----

    def _subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        # Queue size 64 because we multiplex three event types on one queue:
        # reset (rare), snapshot ticks (5 Hz), and bursty order_log entries.
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
        # Prime with a `reset` envelope so the client knows the current ticker
        # without an extra HTTP fetch — order matters: reset before snapshot so
        # a late joiner can clear stale buffers (if any) before applying the
        # first tick that follows.
        try:
            q.put_nowait({"event": "reset", "data": self.state_payload()})
        except asyncio.QueueFull:
            pass
        # Then the current snapshot so the client doesn't have to wait a full tick.
        try:
            q.put_nowait(
                {
                    "event": "snapshot",
                    "data": _serialize_snapshot(self.exchange.snapshot()),
                }
            )
        except asyncio.QueueFull:
            pass
        # Replay the rolling buffer of recent decisions (oldest first) so a late
        # joiner doesn't see an empty Order-log panel.
        for entry in self._order_log:
            try:
                q.put_nowait({"event": "order_log", "data": entry})
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

    # ---- order log ----

    def record_decision(self, persona: TraderPersona, decision: TraderDecision) -> None:
        """Record an LLM decision and broadcast it to all SSE subscribers.

        Called by the swarm immediately after the agent yields a TraderDecision —
        before any submit, so HOLDs and orders that later get killed are still
        visible in the order log alongside successful trades.
        """
        entry = _serialize_agent_decision(persona, decision)
        self._order_log.append(entry)
        self._broadcast({"event": "order_log", "data": entry})

    def record_manual_order(self, order: Order) -> None:
        """Record a manually-submitted order and broadcast it.

        Called by the HTTP submit endpoint. Carries no reasoning — the UI
        distinguishes manual entries via ``source="manual"``.
        """
        entry = _serialize_manual_order(order)
        self._order_log.append(entry)
        self._broadcast({"event": "order_log", "data": entry})

    # ---- bootstrap / respawn ----

    async def respawn(
        self,
        payload: BootstrapPayload,
        *,
        personas: Iterable[TraderPersona] = (),
    ) -> None:
        """Replace the live simulation with a fresh one seeded from ``payload``.

        Steps, in order:
            1. Cancel the tick task (if running) so no fills sneak in mid-swap.
            2. Construct a fresh ``Exchange`` + ``NewsBus`` at the new fair.
            3. Re-register every persona on the new exchange so their
               ``initial_cash`` is preserved (the swarm holds personas; the
               caller passes them in to keep this module swarm-agnostic).
            4. Publish each seed headline (anchored at ``tick_id=0``).
            5. Clear the rolling order-log — old decisions belong to the old
               universe and would mislead the UI tape after the swap.
            6. Broadcast a ``reset`` envelope so live subscribers drop their
               chart/timeline buffers and update their header.
            7. Restart the tick task if we'd been ticking before.
        """
        # Materialise once — `personas` may be a generator and we walk it twice.
        persona_list = list(personas)

        was_ticking = self._task is not None and not self._task.done()
        await self.stop()

        self.exchange = Exchange(params=self._params, initial_fair=payload.initial_fair)
        self.news_bus = NewsBus(self.exchange)
        self.ticker = payload.ticker
        self.ticker_name = payload.name
        self.fetched_at = payload.fetched_at
        self._order_log.clear()

        # Re-register personas so their accounts carry forward with their
        # configured initial_cash (rather than auto-registering at $0 on the
        # first observe()).
        for persona in persona_list:
            self.exchange.register(persona.agent_id, initial_cash=persona.initial_cash)

        for hl in payload.seed_news:
            # Anchored at tick_id=0 already in the payload, but the bus stamps
            # current_tick_id on publish — at this moment the new exchange is
            # at tick_id=0, so the anchor matches naturally.
            self.news_bus.publish(
                source=hl.source,
                headline=hl.headline,
                body=hl.body,
            )

        self._broadcast({"event": "reset", "data": self.state_payload()})

        if was_ticking:
            self.start()

        logger.info(
            "respawn ok ticker=%s name=%s fair=%.4f personas=%d seed_news=%d",
            self.ticker,
            self.ticker_name,
            self.exchange.state.fair,
            len(persona_list),
            len(payload.seed_news),
        )

    # ---- tick loop ----

    async def _run(self) -> None:
        try:
            while True:
                self._counter += 1
                advance_event = self._counter % EVENT_TICK_EVERY == 0
                snap = self.exchange.tick(advance_event=advance_event)
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
