"""Observation builder: NewsView projection + pct_change_since math."""

from __future__ import annotations

import pytest

from agents.observation import build_news_view, build_trader_context
from agents.schemas import RiskTolerance, TimeHorizon, TraderArchetype, TraderPersona
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


@pytest.fixture
def bus(exchange: Exchange) -> NewsBus:
    return NewsBus(exchange)


@pytest.fixture
def persona() -> TraderPersona:
    return TraderPersona(
        agent_id="agent_test",
        display_name="Tester",
        archetype=TraderArchetype.RETAIL,
        risk_tolerance=RiskTolerance.MODERATE,
        time_horizon=TimeHorizon.SHORT_TERM,
        max_order_size=50,
        backstory="Synthetic test persona.",
    )


def test_no_news_yields_empty_view(exchange: Exchange, bus: NewsBus):
    assert build_news_view(bus, exchange) == []


def test_pct_change_zero_when_no_fair_movement(exchange: Exchange, bus: NewsBus):
    bus.publish(source="user", headline="quiet news")
    views = build_news_view(bus, exchange)
    assert len(views) == 1
    assert views[0].pct_change_since == pytest.approx(0.0)
    assert views[0].headline == "quiet news"


def test_pct_change_reflects_move_since_anchor(exchange: Exchange, bus: NewsBus):
    """Headline lands at fair=100, market moves, view reports the % move."""
    bus.publish(source="user", headline="anchor")
    fair_before = exchange.state.fair

    # Drive fair upward via a buy.
    exchange.submit(Order(agent_id="trader", limit=1e9, qty=5))
    exchange.tick()
    fair_after = exchange.state.fair
    assert fair_after > fair_before

    [view] = build_news_view(bus, exchange)
    expected = (fair_after - fair_before) / fair_before * 100.0
    assert view.pct_change_since == pytest.approx(expected)


def test_each_headline_has_its_own_anchor(exchange: Exchange, bus: NewsBus):
    """Older headlines see a larger cumulative move than newer ones."""
    bus.publish(source="user", headline="old")
    fair_old_anchor = exchange.state.fair

    exchange.submit(Order(agent_id="trader", limit=1e9, qty=3))
    exchange.tick()

    bus.publish(source="user", headline="new")
    fair_new_anchor = exchange.state.fair

    exchange.submit(Order(agent_id="trader", limit=1e9, qty=3))
    exchange.tick()
    fair_now = exchange.state.fair

    views = build_news_view(bus, exchange)  # newest first
    assert [v.headline for v in views] == ["new", "old"]

    pct_new = (fair_now - fair_new_anchor) / fair_new_anchor * 100.0
    pct_old = (fair_now - fair_old_anchor) / fair_old_anchor * 100.0
    assert views[0].pct_change_since == pytest.approx(pct_new)
    assert views[1].pct_change_since == pytest.approx(pct_old)
    assert pct_old > pct_new  # older headline has accumulated more drift


def test_news_limit_caps_view_count(exchange: Exchange, bus: NewsBus):
    for i in range(8):
        bus.publish(source="user", headline=f"h{i}")
    views = build_news_view(bus, exchange, n=3)
    assert len(views) == 3
    # newest first
    assert [v.headline for v in views] == ["h7", "h6", "h5"]


def test_build_trader_context_wires_world(
    exchange: Exchange, bus: NewsBus, persona: TraderPersona
):
    bus.publish(source="user", headline="big news")
    ctx = build_trader_context(persona=persona, exchange=exchange, news_bus=bus)
    assert ctx.persona.agent_id == persona.agent_id
    assert ctx.market.fair == pytest.approx(exchange.state.fair)
    assert ctx.account.agent_id == persona.agent_id
    assert len(ctx.news) == 1
    assert ctx.news[0].headline == "big news"
