"""News bus: in-process pub/sub of headlines anchored to exchange tick_id.

A headline lands at a specific `tick_id` (exchange time). Agents don't see the
tick_id directly — at observation-build time we look up `exchange.price_at(tick_id)`
and expose a scalar `pct_change_since` in the lean `NewsView`.
"""

from .bus import NewsBus
from .types import SECONDS_PER_TICK, NewsHeadline

__all__ = ["SECONDS_PER_TICK", "NewsBus", "NewsHeadline"]
