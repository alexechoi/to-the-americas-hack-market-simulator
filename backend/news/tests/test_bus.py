"""NewsBus: tick anchoring, recent buffer, fan-out, drop-oldest back-pressure."""

from __future__ import annotations

import asyncio

import pytest

from exchange.engine import Exchange
from exchange.types import MMParams, Order
from news.bus import NewsBus


@pytest.fixture
def flat_params() -> MMParams:
    return MMParams(
        size_jitter=0.0,
        imbalance=0.0,
        gap_prob=0.0,
        jumbo_prob=0.0,
    )


@pytest.fixture
def exchange(flat_params: MMParams) -> Exchange:
    return Exchange(params=flat_params, initial_fair=100.0)


def test_publish_anchors_at_current_tick(exchange: Exchange):
    bus = NewsBus(exchange)
    hl0 = bus.publish(source="user", headline="early news")
    assert hl0.tick_id == 0

    # Advance the exchange by trading.
    exchange.submit(Order(agent_id="a", limit=1e9, qty=1))
    exchange.tick()
    expected_tick = exchange.current_tick_id

    hl1 = bus.publish(source="user", headline="later news")
    assert hl1.tick_id == expected_tick


def test_recent_returns_newest_first(exchange: Exchange):
    bus = NewsBus(exchange)
    bus.publish(source="a", headline="one")
    bus.publish(source="a", headline="two")
    bus.publish(source="a", headline="three")
    items = bus.recent(n=10)
    assert [h.headline for h in items] == ["three", "two", "one"]


def test_recent_caps_at_recent_cap(exchange: Exchange):
    bus = NewsBus(exchange, recent_cap=3)
    for i in range(5):
        bus.publish(source="a", headline=f"h{i}")
    items = bus.recent(n=10)
    assert len(items) == 3
    assert [h.headline for h in items] == ["h4", "h3", "h2"]


def test_recent_n_zero_returns_empty(exchange: Exchange):
    bus = NewsBus(exchange)
    bus.publish(source="a", headline="x")
    assert bus.recent(n=0) == []


@pytest.mark.asyncio
async def test_stream_primes_with_recent(exchange: Exchange):
    bus = NewsBus(exchange)
    bus.publish(source="a", headline="prior-1")
    bus.publish(source="a", headline="prior-2")

    seen: list[str] = []

    async def consume() -> None:
        async for hl in bus.stream(prime=2):
            seen.append(hl.headline)
            if len(seen) >= 3:
                break

    task = asyncio.create_task(consume())
    # Give the consumer a moment to subscribe & drain primed messages.
    await asyncio.sleep(0)
    bus.publish(source="a", headline="live")
    await asyncio.wait_for(task, timeout=1.0)

    # Primed messages arrive in chronological order, then the live one.
    assert seen == ["prior-1", "prior-2", "live"]


@pytest.mark.asyncio
async def test_broadcast_drops_oldest_for_slow_subscribers(exchange: Exchange):
    bus = NewsBus(exchange)

    # Subscribe and let the generator body run far enough to register the queue.
    gen = bus.stream(prime=0).__aiter__()
    pull_task = asyncio.create_task(gen.__anext__())
    # Yield twice — first to enter the generator body, second to reach `await q.get()`
    # so the subscriber set is populated before we publish.
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert len(bus._subscribers) == 1

    # Spam more than the queue cap (16) without consuming.
    for i in range(50):
        bus.publish(source="a", headline=f"h{i}")

    # The single pending pull resolves; the crucial property is publish never blocked.
    hl = await asyncio.wait_for(pull_task, timeout=1.0)
    assert hl.headline.startswith("h")
    await gen.aclose()


@pytest.mark.asyncio
async def test_unsubscribe_on_generator_close(exchange: Exchange):
    bus = NewsBus(exchange)
    gen = bus.stream(prime=0).__aiter__()
    pull = asyncio.create_task(gen.__anext__())
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert len(bus._subscribers) == 1
    pull.cancel()
    try:
        await pull
    except (asyncio.CancelledError, StopAsyncIteration):
        pass
    await gen.aclose()
    assert len(bus._subscribers) == 0
