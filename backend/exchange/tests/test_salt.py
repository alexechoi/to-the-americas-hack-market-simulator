"""Salt determinism and statistics."""

from __future__ import annotations


from exchange.ladder import build_ladder
from exchange.types import MMParams


def test_deterministic_per_seed():
    p = MMParams(salt_seed=123)
    for t in range(50):
        assert build_ladder(100.0, t, p) == build_ladder(100.0, t, p)


def test_different_seeds_differ():
    p1 = MMParams(salt_seed=1)
    p2 = MMParams(salt_seed=2)
    different = 0
    for t in range(30):
        if build_ladder(100.0, t, p1) != build_ladder(100.0, t, p2):
            different += 1
    assert different > 25


def test_imbalance_asymmetry_fires():
    """Across many ticks, total bid depth != total ask depth on at least some ticks."""
    p = MMParams(
        imbalance=0.5, salt_seed=7, size_jitter=0.0, gap_prob=0.0, jumbo_prob=0.0
    )
    deltas = []
    for t in range(100):
        lad = build_ladder(100.0, t, p)
        bid_total = sum(s for _, s in lad.bids)
        ask_total = sum(s for _, s in lad.asks)
        deltas.append(bid_total - ask_total)
    # The distribution should not be all zeros — imbalance varies per tick.
    assert any(d != 0 for d in deltas)
    # And both directions should show up.
    assert any(d > 0 for d in deltas)
    assert any(d < 0 for d in deltas)


def test_jumbo_frequency_in_tolerance():
    p = MMParams(
        jumbo_prob=0.1,
        jumbo_mult=5.0,
        size_jitter=0.0,
        imbalance=0.0,
        gap_prob=0.0,
        salt_seed=13,
    )
    n_levels = 0
    n_jumbos = 0
    for t in range(500):
        lad = build_ladder(100.0, t, p)
        for _, size in lad.bids + lad.asks:
            n_levels += 1
            # With size_jitter=0 and imbalance=0, non-jumbo levels are exactly level_size;
            # jumbos are exactly level_size * jumbo_mult.
            if size >= p.level_size * p.jumbo_mult * 0.99:
                n_jumbos += 1
    rate = n_jumbos / n_levels
    assert 0.07 < rate < 0.13  # ±3 percentage points of 0.1


def test_gap_frequency_in_tolerance():
    p = MMParams(
        gap_prob=0.2,
        size_jitter=0.0,
        imbalance=0.0,
        jumbo_prob=0.0,
        salt_seed=19,
        ladder_depth=10,
    )
    total_pairs = 0
    gap_pairs = 0
    for t in range(500):
        lad = build_ladder(100.0, t, p)
        for side in (lad.bids, lad.asks):
            # Count gaps as any consecutive pair with >1 tick of price distance.
            for a, b in zip(side, side[1:]):
                total_pairs += 1
                if abs(b[0] - a[0]) > p.tick * 1.5:
                    gap_pairs += 1
    rate = gap_pairs / total_pairs
    # With gap_prob=0.2 on levels 1..N-1 only (level 0 never gets a gap before it),
    # expected rate per consecutive pair ≈ 0.2.
    assert 0.15 < rate < 0.25
