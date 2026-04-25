"""Singleton exchange runtime: owns the Exchange, drives the tick loop, broadcasts via SSE."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

from exchange import Exchange, MMParams
from exchange.types import Snapshot

logger = logging.getLogger(__name__)

# Cadence configuration — keep here so it's tweakable in one place.
UI_TICK_PERIOD_S = 0.2          # 5 Hz salt re-roll / breathing
EVENT_TICK_EVERY = 5            # every Nth UI tick advances an event tick (=> 1 Hz event ticks)


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


class ExchangeRuntime:
    """
    Single shared Exchange instance plus a background async task that ticks it
    and fans out snapshots to any number of SSE subscribers.
    """

    def __init__(self, params: MMParams | None = None, initial_fair: float = 100.0) -> None:
        self.exchange = Exchange(params=params or MMParams(), initial_fair=initial_fair)
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
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
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
        # Prime with the current state so the client doesn't have to wait a full tick.
        try:
            q.put_nowait(_serialize_snapshot(self.exchange.snapshot()))
        except asyncio.QueueFull:
            pass
        self._subscribers.add(q)
        return q

    def _unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(q)

    async def stream(self) -> AsyncIterator[dict[str, Any]]:
        """Async generator yielding one snapshot dict per backend tick."""
        q = self._subscribe()
        try:
            while True:
                yield await q.get()
        finally:
            self._unsubscribe(q)

    def _broadcast(self, payload: dict[str, Any]) -> None:
        # Drop messages on slow consumers rather than blocking the tick loop.
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                # Slow consumer — drop oldest, push newest, so they catch up to current state.
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(payload)
                except asyncio.QueueFull:
                    pass

    # ---- tick loop ----

    async def _run(self) -> None:
        try:
            while True:
                self._counter += 1
                advance_event = self._counter % EVENT_TICK_EVERY == 0
                snap = self.exchange.tick(advance_event=advance_event)
                self._broadcast(_serialize_snapshot(snap))
                await asyncio.sleep(UI_TICK_PERIOD_S)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Exchange tick loop crashed")
            raise


# Module-level singleton — single shared simulation per backend process.
runtime = ExchangeRuntime()
