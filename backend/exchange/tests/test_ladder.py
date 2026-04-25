"""Tests for the pure ladder builder."""

from __future__ import annotations

import math

import pytest

from exchange.ladder import build_ladder, half_spread
from exchange.types import MMParams


@pytest.fixture
def params() -> MMParams:
    return MMParams(salt_seed=42)


def test_inside_spread_exact(params: MMParams):
    """best_bid / best_ask are always exactly fair ± half_spread, regardless of salt."""
    hs = half_spread(params)
    fair = 100.0
    for t in range(50):
        lad = build_ladder(fair, t, params)
        assert math.isclose(lad.bids[0][0], fair - hs, abs_tol=1e-9)
        assert math.isclose(lad.asks[0][0], fair + hs, abs_tol=1e-9)


def test_deterministic_given_seed_and_tick(params: MMParams):
    """Same (fair, tick_id, salt_seed) yields a bit-identical ladder."""
    fair = 100.0
    for t in range(20):
        a = build_ladder(fair, t, params)
        b = build_ladder(fair, t, params)
        assert a == b


def test_different_ticks_usually_differ(params: MMParams):
    """Over many ticks the salt does produce distinct ladders."""
    fair = 100.0
    ladders = {build_ladder(fair, t, params) for t in range(40)}
    # Not every tick has to differ, but with 40 rolls and nontrivial salt params
    # we expect a lot of unique ladders.
    assert len(ladders) >= 30


def test_prices_on_grid(params: MMParams):
    """Every price lies on the fair ± n·tick grid for some integer n."""
    fair = 100.0
    for t in range(20):
        lad = build_ladder(fair, t, params)
        for price, _ in lad.bids + lad.asks:
            offset = (price - fair) / params.tick
            assert math.isclose(offset, round(offset), abs_tol=1e-6), (
                f"price {price} off-grid (offset={offset})"
            )


def test_monotone_prices(params: MMParams):
    """Asks strictly increasing, bids strictly decreasing."""
    for t in range(20):
        lad = build_ladder(100.0, t, params)
        for a, b in zip(lad.asks, lad.asks[1:]):
            assert a[0] < b[0]
        for a, b in zip(lad.bids, lad.bids[1:]):
            assert a[0] > b[0]


def test_sizes_positive(params: MMParams):
    for t in range(20):
        lad = build_ladder(100.0, t, params)
        for _, size in lad.bids + lad.asks:
            assert size >= 1


def test_ladder_depth_respected(params: MMParams):
    lad = build_ladder(100.0, 0, params)
    assert len(lad.bids) == params.ladder_depth
    assert len(lad.asks) == params.ladder_depth


def test_half_spread_floor():
    """half_spread is at least one tick even when α·σ is tiny."""
    p = MMParams(tick=0.01, vol=0.0, half_spread_coef=1.0)
    assert half_spread(p) == pytest.approx(0.01)
