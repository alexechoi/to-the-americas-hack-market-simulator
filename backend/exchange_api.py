"""HTTP/SSE surface for the exchange runtime."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from exchange.types import Fill, Hold, Killed, Order, OrderResult
from runtime import _serialize_snapshot, runtime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exchange", tags=["exchange"])


# ---------- request / response models ----------


class OrderRequest(BaseModel):
    """Manual FOK submission. qty > 0 buys, qty < 0 sells, qty == 0 holds."""

    agent_id: str = Field(..., min_length=1, max_length=64)
    limit: float
    qty: int


# ---------- routes ----------


@router.get("/snapshot")
def get_snapshot():
    """One-shot read of current exchange state. Useful for debug; live UI should use /stream."""
    return _serialize_snapshot(runtime.exchange.snapshot())


@router.get("/history")
def get_history(since_tick: int | None = None) -> list[dict[str, Any]]:
    """Price history — one point per fair mutation, keyed on exchange tick_id.

    Intended for the frontend chart to hydrate on mount without replaying the full
    SSE stream, and for agents / tools reasoning about `pct_change_since` anchors.
    """
    return [
        {"tick_id": p.tick_id, "fair": p.fair}
        for p in runtime.exchange.price_history(since_tick=since_tick)
    ]


@router.get("/account/{agent_id}")
def get_account(agent_id: str):
    runtime.exchange.register(agent_id)
    a = runtime.exchange.account(agent_id)
    return {
        "agent_id": a.agent_id,
        "inventory": a.inventory,
        "cash": a.cash,
        "equity": a.equity,
        "n_fills": a.n_fills,
    }


def _serialize_result(result: OrderResult) -> dict[str, Any]:
    """Convert an OrderResult dataclass to a JSON-friendly dict for the wire."""
    if isinstance(result, Fill):
        return {
            "status": "filled",
            "agent_id": result.agent_id,
            "qty": result.qty,
            "vwap": result.vwap,
            "levels": [{"price": p, "size": s} for p, s in result.levels],
        }
    if isinstance(result, Killed):
        return {
            "status": "killed",
            "agent_id": result.agent_id,
            "reason": result.reason,
        }
    if isinstance(result, Hold):
        return {"status": "hold", "agent_id": result.agent_id}
    raise TypeError(f"unknown OrderResult: {result!r}")


@router.post("/orders")
async def submit_order(req: OrderRequest) -> dict[str, Any]:
    """
    Submit a Fill-Or-Kill order and execute it immediately against the current ladder.

    Returns the actual outcome (filled / killed / hold). The trade also lands in the
    SSE stream's recent_trades within the next backend tick.
    """
    if abs(req.qty) > 1_000_000:
        raise HTTPException(status_code=400, detail="qty out of range")
    order = Order(agent_id=req.agent_id, limit=float(req.limit), qty=int(req.qty))
    # Async handler runs on the event loop, so this is naturally serialized
    # with the tick loop — no explicit lock needed.
    result = runtime.exchange.execute_now(order)
    return _serialize_result(result)


@router.get("/stream")
async def stream():
    """
    Server-Sent Events stream of Snapshot dicts.

    The first event is the current state; subsequent events fire on every backend tick
    (5 Hz UI breathe + 1 Hz event ticks, configured in runtime.py).
    """

    async def event_generator():
        try:
            async for snap in runtime.stream():
                yield {"event": "snapshot", "data": json.dumps(snap)}
        except asyncio.CancelledError:
            # Client disconnected — clean up handled by stream() finally block.
            raise

    return EventSourceResponse(event_generator())
