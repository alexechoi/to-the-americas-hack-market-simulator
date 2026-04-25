"""Wire-format types for the news bus.

`NewsHeadline` is the persisted / HTTP-facing shape. The LLM-facing shape is
`agents.schemas.NewsView` — leaner (just headline, source, pct_change_since).
"""

from __future__ import annotations

import time
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class NewsHeadline(BaseModel):
    """A headline injected into the simulation.

    `tick_id` is the exchange's authoritative clock at the moment the headline was
    published — all derived simulation math (price anchors, `pct_change_since`)
    keys off this so behavior is replayable and pause-safe. `ts` is a wall-clock
    unix-second stamp captured at the same moment, used purely for display
    ("2m ago"). Seed headlines that predate the first tick should pass `tick_id=0`.
    """

    model_config = ConfigDict(frozen=True)

    headline_id: str = Field(default_factory=lambda: f"news_{uuid4().hex[:8]}")
    tick_id: int = Field(
        ge=0,
        description="Exchange tick_id at publish time. Anchor for pct_change_since.",
    )
    ts: float = Field(
        default_factory=time.time,
        description="Wall-clock unix seconds at publish time. Display-only.",
    )
    source: str = Field(default="user", min_length=1, max_length=64)
    headline: str = Field(min_length=1, max_length=512)
    body: str | None = Field(default=None, max_length=4_000)
