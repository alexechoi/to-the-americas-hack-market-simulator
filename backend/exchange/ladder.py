"""Pure ladder builder. Deterministic for a given (fair, tick_id, salt_seed)."""

from __future__ import annotations

import random

from .types import Ladder, MMParams


def half_spread(p: MMParams) -> float:
    """Inside half-spread. Always at least one tick so best_bid < best_ask."""
    return max(p.tick, p.half_spread_coef * p.vol)


def build_ladder(fair: float, tick_id: int, p: MMParams) -> Ladder:
    """
    Build a salted ladder around `fair`.

    Invariants:
      - best_bid = fair - half_spread(p), best_ask = fair + half_spread(p)  (exact, regardless of salt)
      - all prices lie on the fair ± n·tick grid
      - same (fair, tick_id, p.salt_seed) always produces the same Ladder
    """
    rng = random.Random(f"ladder:{p.salt_seed}:{tick_id}")
    hs = half_spread(p)

    # bid/ask imbalance: correlated asymmetry across each side
    imb = 1.0 + p.imbalance * rng.uniform(-1.0, 1.0)
    bid_mult, ask_mult = imb, 2.0 - imb

    def side(sign: int, mult: float) -> tuple[tuple[float, int], ...]:
        levels: list[tuple[float, int]] = []
        offset = 0
        for i in range(p.ladder_depth):
            # Only insert gaps beyond the inside so best_bid / best_ask stay exact.
            if i > 0 and rng.random() < p.gap_prob:
                offset += 1
            price = round(fair + sign * (hs + offset * p.tick), 4)
            # Depth taper: deeper levels carry more size (linear in level index).
            depth_mult = 1.0 + i * p.size_growth
            size = (
                p.level_size
                * mult
                * depth_mult
                * (1.0 + p.size_jitter * rng.uniform(-1.0, 1.0))
            )
            if rng.random() < p.jumbo_prob:
                size *= p.jumbo_mult
            levels.append((price, max(1, round(size))))
            offset += 1
        return tuple(levels)

    return Ladder(bids=side(-1, bid_mult), asks=side(+1, ask_mult))
