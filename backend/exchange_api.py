"""HTTP/SSE surface for the exchange runtime."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from exchange.types import Order
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


@router.post("/orders")
def submit_order(req: OrderRequest):
    """Queue an FOK order. It'll be processed on the next event tick."""
    if abs(req.qty) > 1_000_000:
        raise HTTPException(status_code=400, detail="qty out of range")
    order = Order(agent_id=req.agent_id, limit=float(req.limit), qty=int(req.qty))
    runtime.exchange.submit(order)
    return {"queued": True, "agent_id": order.agent_id, "limit": order.limit, "qty": order.qty}


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
