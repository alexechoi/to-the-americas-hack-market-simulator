"""Depth-weighted Kyle λ fair-price update."""

from __future__ import annotations


import pytest

from exchange.engine import Exchange
from exchange.ladder import build_ladder
from exchange.types import MMParams, Order


@pytest.fixture
def flat_params() -> MMParams:
    # Disable salt so ladders are predictable across ticks.
    return MMParams(
        size_jitter=0.0,
        imbalance=0.0,
        gap_prob=0.0,
        jumbo_prob=0.0,
    )


def test_top_of_book_buy_matches_linear_lambda(flat_params: MMParams):
    """At top of book only, Δfair ≈ λ · qty (exactly, since p - fair = half_spread)."""
    ex = Exchange(params=flat_params, initial_fair=100.0)
    future = build_ladder(100.0, 1, flat_params)
    first_size = future.asks[0][1]
    qty = min(3, first_size)
    fair_before = ex.state.fair
    ex.submit(Order(agent_id="a", limit=1e9, qty=qty))
    ex.tick()
    delta = ex.state.fair - fair_before
    assert delta == pytest.approx(flat_params.kyle_lambda * qty, rel=1e-9)


def test_sweep_moves_fair_strictly_more_than_top_of_book(flat_params: MMParams):
    """
    Two exchanges, same qty: one trades entirely at top of book, the other sweeps.
    The sweep must move fair strictly more.

    To isolate this we craft:
      - Exchange A with level_size large enough that qty fits entirely at level 0.
      - Exchange B with level_size small so qty must walk to deeper levels.
    Both must have the same top-of-book price so the comparison is meaningful.
    """
    qty = 30
    p_top = MMParams(
        size_jitter=0.0, imbalance=0.0, gap_prob=0.0, jumbo_prob=0.0,
        level_size=qty, ladder_depth=10,
    )
    p_sweep = MMParams(
        size_jitter=0.0, imbalance=0.0, gap_prob=0.0, jumbo_prob=0.0,
        level_size=qty // 6, ladder_depth=10,
    )
    a = Exchange(params=p_top, initial_fair=100.0)
    b = Exchange(params=p_sweep, initial_fair=100.0)
    a.submit(Order(agent_id="a", limit=1e9, qty=qty))
    b.submit(Order(agent_id="a", limit=1e9, qty=qty))
    a.tick()
    b.tick()
    da, db = a.state.fair - 100.0, b.state.fair - 100.0
    assert db > da > 0


def test_sell_symmetric_to_buy(flat_params: MMParams):
    """A sell of the same size at top of book moves fair down by λ·qty."""
    ex = Exchange(params=flat_params, initial_fair=100.0)
    future = build_ladder(100.0, 1, flat_params)
    qty = min(3, future.bids[0][1])
    fair_before = ex.state.fair
    ex.submit(Order(agent_id="a", limit=0.0, qty=-qty))
    ex.tick()
    delta = ex.state.fair - fair_before
    assert delta == pytest.approx(-flat_params.kyle_lambda * qty, rel=1e-9)


def test_buy_then_sell_same_tick_approximately_cancels(flat_params: MMParams):
    """
    Submit a buy and a sell of the same size; by end of tick, the net fair displacement
    is bounded by the quadratic Kyle term rather than zero exactly (because the ladder
    is rebuilt off the moving fair intra-tick between executions). Both orders are in the
    same tick_id so they see the same salted ladder at submit time, but the second
    order's fill walks the ladder computed from the *post-first-fill* fair.
    Assert the residual is small relative to the single-trade impact.
    """
    ex = Exchange(params=flat_params, initial_fair=100.0)
    qty = 3
    ex.submit(Order(agent_id="a", limit=1e9, qty=qty))
    ex.submit(Order(agent_id="b", limit=0.0, qty=-qty))
    ex.tick()
    single = flat_params.kyle_lambda * qty
    residual = abs(ex.state.fair - 100.0)
    # Allow residual up to the size of a single λ·qty impact — we are mostly verifying
    # that the two trades roughly cancel, not that they cancel exactly.
    assert residual < single
