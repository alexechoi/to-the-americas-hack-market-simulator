"""ExchangeRuntime.respawn: state swap, persona re-registration, reset broadcast.

These tests build a fresh ``ExchangeRuntime`` per case (so the module-level
singleton stays untouched) and synthesise a ``BootstrapPayload`` directly,
bypassing the Yahoo path entirely.
"""

from __future__ import annotations

import pytest

from agents.schemas import (
    RiskTolerance,
    TimeHorizon,
    TraderArchetype,
    TraderDecision,
    TraderAction,
    TraderPersona,
)
from bootstrap import BootstrapPayload
from news import NewsHeadline
from runtime import ExchangeRuntime


def _persona(
    agent_id: str = "test-1", initial_cash: float = 250_000.0
) -> TraderPersona:
    return TraderPersona(
        agent_id=agent_id,
        display_name="Tester",
        archetype=TraderArchetype.RETAIL,
        risk_tolerance=RiskTolerance.MODERATE,
        time_horizon=TimeHorizon.SHORT_TERM,
        initial_cash=initial_cash,
        max_position=500,
        max_order_size=50,
        backstory="Synthetic test persona.",
    )


def _payload(
    ticker: str = "AAPL",
    fair: float = 200.0,
    seed: list[NewsHeadline] | None = None,
) -> BootstrapPayload:
    return BootstrapPayload(
        ticker=ticker,
        name=f"{ticker} Inc.",
        initial_fair=fair,
        seed_news=seed
        or [NewsHeadline(tick_id=0, source="yahoo:Reuters", headline="warm-up news")],
        fetched_at="2026-04-25T00:00:00Z",
    )


async def test_respawn_swaps_exchange_and_news_bus():
    rt = ExchangeRuntime(initial_fair=100.0, ticker="NVDA", ticker_name="NVIDIA Corp")
    old_exchange = rt.exchange
    old_bus = rt.news_bus

    await rt.respawn(_payload(ticker="AAPL", fair=200.0))

    assert rt.exchange is not old_exchange
    assert rt.news_bus is not old_bus
    assert rt.ticker == "AAPL"
    assert rt.ticker_name == "AAPL Inc."
    assert rt.exchange.state.fair == pytest.approx(200.0)


async def test_respawn_reregisters_personas_with_initial_cash():
    rt = ExchangeRuntime()
    p = _persona(agent_id="hf-01", initial_cash=750_000.0)

    await rt.respawn(_payload(), personas=[p])

    snapshot = rt.exchange.account("hf-01")
    assert snapshot.cash == pytest.approx(750_000.0)


async def test_respawn_publishes_seed_news_anchored_at_zero():
    rt = ExchangeRuntime()
    seed = [
        NewsHeadline(tick_id=0, source="yahoo:Reuters", headline="alpha"),
        NewsHeadline(tick_id=0, source="yahoo:Bloomberg", headline="beta"),
    ]

    await rt.respawn(_payload(seed=seed))

    recent = rt.news_bus.recent(n=5)
    assert {hl.headline for hl in recent} == {"alpha", "beta"}
    # All seeded headlines must be anchored at the new exchange's tick=0 so
    # `pct_change_since` math doesn't reach back into the previous universe.
    assert all(hl.tick_id == 0 for hl in recent)


async def test_respawn_clears_order_log():
    rt = ExchangeRuntime()
    persona = _persona()
    decision = TraderDecision(
        action=TraderAction.BUY,
        quantity=10,
        limit_price=101.0,
        confidence=0.9,
        reasoning="legacy order from pre-spawn universe",
    )
    rt.record_decision(persona, decision)
    assert len(rt._order_log) == 1

    await rt.respawn(_payload())
    assert len(rt._order_log) == 0


async def test_respawn_broadcasts_reset_event_to_subscribers():
    rt = ExchangeRuntime()

    # Manually subscribe to capture envelopes (mirrors what stream() does).
    q = rt._subscribe()
    # Drain the subscribe-prime burst (initial reset + initial snapshot) so we
    # only inspect what respawn emits.
    while not q.empty():
        q.get_nowait()

    await rt.respawn(_payload(ticker="AAPL", fair=200.0))

    # The respawn flow should emit at minimum a `reset` envelope. Drain every-
    # thing currently on the queue and assert one of them is the reset.
    drained: list[dict] = []
    while not q.empty():
        drained.append(q.get_nowait())

    resets = [e for e in drained if e.get("event") == "reset"]
    assert len(resets) == 1
    data = resets[0]["data"]
    assert data["ticker"] == "AAPL"
    assert data["name"] == "AAPL Inc."
    assert data["fair"] == pytest.approx(200.0)


async def test_respawn_preserves_tick_loop_running_state():
    """If we were ticking before respawn, we should still be ticking after."""
    rt = ExchangeRuntime()
    rt.start()
    try:
        await rt.respawn(_payload())
        assert rt._task is not None
        assert not rt._task.done()
    finally:
        await rt.stop()


async def test_respawn_does_not_start_loop_if_was_idle():
    """Respawning a never-started runtime should leave it idle."""
    rt = ExchangeRuntime()
    assert rt._task is None
    await rt.respawn(_payload())
    assert rt._task is None
