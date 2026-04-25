"""FOK matching semantics."""

from __future__ import annotations


import pytest

from exchange.engine import Exchange
from exchange.ladder import build_ladder
from exchange.types import Fill, MMParams, Order


@pytest.fixture
def flat_params() -> MMParams:
    # Disable salt so quantities are uniform and prices are contiguous, making the
    # asserts below trivially predictable. Behaviour of the salted path is covered separately.
    return MMParams(
        size_jitter=0.0,
        imbalance=0.0,
        gap_prob=0.0,
        jumbo_prob=0.0,
        salt_seed=0,
    )


@pytest.fixture
def ex(flat_params: MMParams) -> Exchange:
    return Exchange(params=flat_params, initial_fair=100.0, session_seed=0)


def _advance(ex: Exchange):
    # With no pending orders, still advances tick_id.
    ex.tick(advance_event=False)


def test_hold_on_zero_qty(ex: Exchange):
    ex.submit(Order(agent_id="a", limit=0.0, qty=0))
    snap = ex.tick()
    # Hold doesn't fill; recent_trades empty.
    assert snap.recent_trades == ()


def test_buy_within_limit_fills(ex: Exchange, flat_params: MMParams):
    # Peek tomorrow's ladder (tick will advance to tick_id=1 when we call tick()).
    future = build_ladder(100.0, 1, flat_params)
    best_ask_price, best_ask_size = future.asks[0]
    qty = min(5, best_ask_size)
    ex.submit(Order(agent_id="a", limit=best_ask_price + 0.01, qty=qty))
    snap = ex.tick()
    assert len(snap.recent_trades) == 1
    fill = snap.recent_trades[0]
    assert isinstance(fill, Fill)
    assert fill.qty == qty
    assert fill.vwap == pytest.approx(best_ask_price)


def test_buy_below_best_ask_kills(ex: Exchange, flat_params: MMParams):
    future = build_ladder(100.0, 1, flat_params)
    best_ask_price = future.asks[0][0]
    ex.submit(Order(agent_id="a", limit=best_ask_price - 0.01, qty=1))
    # Route through _execute directly by driving the tick; capture result by replaying.
    # The public API only exposes the trade list. If recent_trades is empty after tick,
    # the FOK was either killed or a hold. We assert killed by confirming fair didn't move.
    fair_before = ex.state.fair
    snap = ex.tick()
    assert snap.recent_trades == ()
    assert ex.state.fair == fair_before


def test_sell_above_best_bid_kills(ex: Exchange, flat_params: MMParams):
    future = build_ladder(100.0, 1, flat_params)
    best_bid_price = future.bids[0][0]
    ex.submit(Order(agent_id="a", limit=best_bid_price + 0.01, qty=-1))
    fair_before = ex.state.fair
    snap = ex.tick()
    assert snap.recent_trades == ()
    assert ex.state.fair == fair_before


def test_qty_exceeding_total_depth_kills(ex: Exchange, flat_params: MMParams):
    future = build_ladder(100.0, 1, flat_params)
    total_ask = sum(s for _, s in future.asks)
    ex.submit(Order(agent_id="a", limit=1e9, qty=total_ask + 1))
    fair_before = ex.state.fair
    snap = ex.tick()
    assert snap.recent_trades == ()
    assert ex.state.fair == fair_before


def test_vwap_across_multiple_levels(ex: Exchange, flat_params: MMParams):
    future = build_ladder(100.0, 1, flat_params)
    # Buy enough to sweep at least 2 levels.
    first_size = future.asks[0][1]
    qty = first_size + 3
    # Verify target has enough depth at the first 2 levels.
    assert qty <= first_size + future.asks[1][1]
    ex.submit(Order(agent_id="a", limit=1e9, qty=qty))
    snap = ex.tick()
    fill = snap.recent_trades[0]
    assert isinstance(fill, Fill)
    # Reconstruct expected vwap from the same ladder function.
    got_levels = list(fill.levels)
    notional = sum(p * q for p, q in got_levels)
    assert fill.vwap == pytest.approx(notional / qty)
    assert sum(q for _, q in got_levels) == qty
    assert got_levels[0] == (future.asks[0][0], first_size)
    assert got_levels[1][0] == future.asks[1][0]


def test_sell_fills_against_bids(ex: Exchange, flat_params: MMParams):
    future = build_ladder(100.0, 1, flat_params)
    best_bid_price, best_bid_size = future.bids[0]
    qty = min(4, best_bid_size)
    ex.submit(Order(agent_id="a", limit=best_bid_price - 0.01, qty=-qty))
    snap = ex.tick()
    fill = snap.recent_trades[0]
    assert fill.qty == -qty
    assert fill.vwap == pytest.approx(best_bid_price)


def test_no_partial_fills(ex: Exchange, flat_params: MMParams):
    future = build_ladder(100.0, 1, flat_params)
    best_ask_price, best_ask_size = future.asks[0]
    # Request more than the first level but cap limit at best ask price → should kill,
    # not partially fill the first level.
    ex.submit(Order(agent_id="a", limit=best_ask_price, qty=best_ask_size + 1))
    fair_before = ex.state.fair
    snap = ex.tick()
    assert snap.recent_trades == ()
    assert ex.state.fair == fair_before
