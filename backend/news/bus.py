"""In-process pub/sub bus for news headlines.

Event-driven (no background task): `publish` fans out immediately to all async
subscribers with drop-oldest back-pressure, mirroring `ExchangeRuntime`'s SSE
fan-out style.

Ownership: held by `ExchangeRuntime` so the simulation owns its own news in the
same process. Tests can construct a bare `NewsBus(exchange)` against a fresh
`Exchange` without going through the runtime.
"""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from typing import AsyncIterator

from exchange import Exchange

from .types import NewsHeadline

logger = logging.getLogger(__name__)


class NewsBus:
    """Publish/subscribe for `NewsHeadline`s, anchored to the exchange's tick_id."""

    def __init__(self, exchange: Exchange, recent_cap: int = 200) -> None:
        self._exchange = exchange
        self._recent: deque[NewsHeadline] = deque(maxlen=recent_cap)
        self._subscribers: set[asyncio.Queue[NewsHeadline]] = set()

    # ---- publish / read ----

    def publish(
        self,
        *,
        source: str,
        headline: str,
        body: str | None = None,
    ) -> NewsHeadline:
        """Anchor at the current exchange tick, broadcast, and remember.

        Also fire-and-forgets the headline into MuBit (when configured) as a
        shared ``fact`` on the active simulation run, so agents can recall it
        on later turns even after it ages out of the in-process recent buffer.
        Memory is a no-op when ``MUBIT_API_KEY`` is unset.
        """
        hl = NewsHeadline(
            tick_id=self._exchange.current_tick_id,
            source=source,
            headline=headline,
            body=body,
        )
        self._recent.append(hl)
        self._broadcast(hl)
        # Imported lazily to avoid a circular import (news -> agents -> news).
        from agents.memory import memory

        memory.remember_headline_async(source=source, headline=headline, body=body)
        logger.info(
            "news_publish id=%s tick=%d source=%s subs=%d",
            hl.headline_id,
            hl.tick_id,
            hl.source,
            len(self._subscribers),
        )
        return hl

    def recent(self, n: int = 10) -> list[NewsHeadline]:
        """Most recent `n` headlines, newest first. Safe to call concurrently."""
        if n <= 0:
            return []
        tail = list(self._recent)[-n:]
        tail.reverse()
        return tail

    # ---- subscribers ----

    async def stream(self, prime: int = 5) -> AsyncIterator[NewsHeadline]:
        """Async iterator yielding each published headline.

        Primes with up to `prime` recent headlines so late joiners don't start empty.
        """
        q: asyncio.Queue[NewsHeadline] = asyncio.Queue(maxsize=16)
        # Seed with recent history (oldest first so order at the consumer is coherent).
        for hl in reversed(self.recent(prime)):
            try:
                q.put_nowait(hl)
            except asyncio.QueueFull:
                break
        self._subscribers.add(q)
        try:
            while True:
                yield await q.get()
        finally:
            self._subscribers.discard(q)

    def _broadcast(self, hl: NewsHeadline) -> None:
        """Drop-oldest fan-out so slow consumers never block publishers."""
        for q in list(self._subscribers):
            try:
                q.put_nowait(hl)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(hl)
                except asyncio.QueueFull:
                    pass
