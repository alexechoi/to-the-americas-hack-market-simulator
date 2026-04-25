"""HTTP/SSE surface for the news bus.

All headlines anchor to `runtime.exchange.current_tick_id` at publish time, so
the only "time" the wire ever exposes is the integer tick. Frontend renders
"x ago" off the SSE arrival order, not a wall-clock timestamp.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from news import NewsHeadline
from runtime import runtime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news", tags=["news"])


# ---------- request models ----------


class InjectRequest(BaseModel):
    """User- or system-initiated headline. `tick_id` is set at publish time."""

    source: str = Field(default="user", min_length=1, max_length=64)
    headline: str = Field(min_length=1, max_length=512)
    body: str | None = Field(default=None, max_length=4_000)


# ---------- routes ----------


@router.post("/inject")
def inject(req: InjectRequest) -> NewsHeadline:
    """Publish a headline to the bus. Returned `NewsHeadline` carries the tick anchor."""
    return runtime.news_bus.publish(
        source=req.source,
        headline=req.headline,
        body=req.body,
    )


@router.get("/recent")
def recent(n: int = 10) -> list[NewsHeadline]:
    """Newest-first list of recent headlines, useful for hydrating the news panel."""
    return runtime.news_bus.recent(n=min(max(n, 1), 100))


@router.get("/stream")
async def stream():
    """Server-Sent Events stream of `NewsHeadline`s, primed with a few recent ones."""

    async def event_generator():
        try:
            async for hl in runtime.news_bus.stream():
                yield {"event": "headline", "data": hl.model_dump_json()}
        except asyncio.CancelledError:
            raise

    return EventSourceResponse(event_generator())
