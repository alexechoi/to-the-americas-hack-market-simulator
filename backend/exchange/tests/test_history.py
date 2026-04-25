"""Price history: append-on-fill, tick_id-keyed lookup, bulk trim."""

from __future__ import annotations

import pytest

from exchange.engine import Exchange
from exchange.types import MMParams, Order


@pytest.fixture
def flat_params() -> MMParams:
    return MMParams(
        size_jitter=0.0,
        imbalance=0.0,
        gap_prob=0.0,
        jumbo_prob=0.0,
    )


def test_seeds_with_initial_fair(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    history = ex.price_history()
    assert len(history) == 1
    assert history[0].tick_id == 0
    assert history[0].fair == 100.0


def test_history_grows_on_fill(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    ex.submit(Order(agent_id="a", limit=1e9, qty=2))
    ex.tick()
    history = ex.price_history()
    # Seed point + one append per fair mutation in _execute.
    assert len(history) == 2
    assert history[1].tick_id == ex.current_tick_id
    assert history[1].fair == ex.state.fair


def test_no_fair_change_no_new_point(flat_params: MMParams):
    """UI ticks (no orders) re-roll the salt but don't mutate fair → no history append."""
    ex = Exchange(params=flat_params, initial_fair=100.0)
    initial_len = len(ex.price_history())
    ex.tick(advance_event=False)
    ex.tick(advance_event=False)
    ex.tick(advance_event=False)
    assert len(ex.price_history()) == initial_len


def test_noise_moves_fair_without_orders():
    """When ``noise_bps > 0``, idle UI ticks move ``fair`` and grow the history.

    The shock is independent of order flow — this is what makes the chart
    breathe during quiet periods.
    """
    params = MMParams(
        size_jitter=0.0, imbalance=0.0, gap_prob=0.0, jumbo_prob=0.0, noise_bps=10.0
    )
    ex = Exchange(params=params, initial_fair=100.0, session_seed=42)
    initial_fair = ex.state.fair
    initial_len = len(ex.price_history())

    for _ in range(50):
        ex.tick(advance_event=False)

    assert ex.state.fair != pytest.approx(initial_fair)
    assert len(ex.price_history()) == initial_len + 50
    # σ per tick = fair · 10 bps = 0.1; over 50 ticks the random walk std ≈ 0.71.
    # The drift should stay well within ±5 σ for any reasonable seed.
    assert abs(ex.state.fair - initial_fair) < 5.0


def test_noise_is_deterministic_across_runs():
    """Same ``salt_seed`` → same random-walk path. Lets demos be reproducible."""
    params = MMParams(
        size_jitter=0.0, imbalance=0.0, gap_prob=0.0, jumbo_prob=0.0, noise_bps=10.0
    )
    a = Exchange(params=params, initial_fair=100.0, session_seed=7)
    b = Exchange(params=params, initial_fair=100.0, session_seed=7)
    for _ in range(20):
        a.tick(advance_event=False)
        b.tick(advance_event=False)
    assert a.state.fair == pytest.approx(b.state.fair)


def test_noise_off_by_default(flat_params: MMParams):
    """``noise_bps`` defaults to 0 — engine stays purely order-driven for tests."""
    assert flat_params.noise_bps == 0.0
    ex = Exchange(params=flat_params, initial_fair=100.0)
    for _ in range(20):
        ex.tick(advance_event=False)
    assert ex.state.fair == pytest.approx(100.0)
    assert len(ex.price_history()) == 1  # just the seed point


def test_price_at_returns_last_recorded_le_tick(flat_params: MMParams):
    """`price_at(t)` is the fair in effect at tick t — the last recorded fair with tick_id ≤ t."""
    ex = Exchange(params=flat_params, initial_fair=100.0)

    ex.submit(Order(agent_id="a", limit=1e9, qty=3))
    ex.tick()
    after_first = ex.state.fair
    first_tick = ex.current_tick_id

    # UI ticks don't change fair, so a query mid-way still returns `after_first`.
    ex.tick(advance_event=False)
    ex.tick(advance_event=False)
    mid_tick = ex.current_tick_id

    ex.submit(Order(agent_id="a", limit=1e9, qty=2))
    ex.tick()
    after_second = ex.state.fair

    assert ex.price_at(0) == 100.0
    assert ex.price_at(first_tick) == after_first
    assert ex.price_at(mid_tick) == after_first  # no fair change between
    assert ex.price_at(ex.current_tick_id) == after_second


def test_price_at_before_seed_returns_seed(flat_params: MMParams):
    """Asking for tick_id=0 hits the seed point exactly."""
    ex = Exchange(params=flat_params, initial_fair=100.0)
    assert ex.price_at(0) == 100.0


def test_price_history_since_filter(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    ex.submit(Order(agent_id="a", limit=1e9, qty=1))
    ex.tick()
    cutoff = ex.current_tick_id
    ex.submit(Order(agent_id="a", limit=1e9, qty=1))
    ex.tick()

    sliced = ex.price_history(since_tick=cutoff)
    assert all(p.tick_id >= cutoff for p in sliced)
    # Original cutoff point is included.
    assert sliced[0].tick_id == cutoff


def test_history_bulk_trim_caps_growth(flat_params: MMParams):
    """When history exceeds cap, oldest 10% is dropped in one slice."""
    ex = Exchange(params=flat_params, initial_fair=100.0, history_cap=10)
    for _ in range(50):
        ex.submit(Order(agent_id="a", limit=1e9, qty=1))
        ex.tick()
    # Cap is 10 → tail-trim happens at 11; we may sit between 9-10 after trim.
    assert len(ex.price_history()) <= 10
    # Latest point still reflects current state.
    assert ex.price_history()[-1].fair == pytest.approx(ex.state.fair)
