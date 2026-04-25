"""HTTP/SSE surface for the exchange runtime."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from bootstrap import BootstrapError, bootstrap_from_yahoo
from exchange.types import Fill, Hold, Killed, Order, OrderResult
from lifecycle import get_lifecycle
from runtime import _serialize_snapshot, runtime
from swarm import agent_swarm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exchange", tags=["exchange"])


# ---------- request / response models ----------


class OrderRequest(BaseModel):
    """Manual FOK submission. qty > 0 buys, qty < 0 sells, qty == 0 holds."""

    agent_id: str = Field(..., min_length=1, max_length=64)
    limit: float
    qty: int


class SpawnRequest(BaseModel):
    """Bootstrap (or rebootstrap) the simulation around a Yahoo-Finance ticker."""

    ticker: str = Field(..., min_length=1, max_length=24)


# ---------- routes ----------


@router.get("/snapshot")
def get_snapshot():
    """One-shot read of current exchange state. Useful for debug; live UI should use /stream."""
    return _serialize_snapshot(runtime.exchange.snapshot())


@router.get("/state")
def get_state() -> dict[str, Any]:
    """Current ticker context: symbol, display name, fair price, last bootstrap timestamp.

    The frontend instrument bar uses this on mount; live updates flow through
    the SSE ``reset`` event so a single fetch is enough at startup.
    """
    return runtime.state_payload()


@router.get("/lifecycle")
def get_lifecycle_status() -> dict[str, Any]:
    """Auto-pause controller status — useful for debugging "why isn't the sim ticking?".

    Returns the current viewer count, whether the sim is running or paused,
    whether a delayed pause is pending, and the configured grace window.
    Returns ``{"configured": False}`` if the lifecycle hasn't been wired yet
    (e.g. during a unit-test import that doesn't run the lifespan).
    """
    lifecycle = get_lifecycle()
    if lifecycle is None:
        return {"configured": False}
    return {"configured": True, **lifecycle.status()}


@router.post("/spawn")
async def spawn(req: SpawnRequest) -> dict[str, Any]:
    """Rebootstrap the simulation around ``req.ticker`` using Yahoo Finance data.

    Pulls current price + a handful of recent headlines, fully resets the
    exchange + news bus, re-registers the swarm's personas with their
    configured initial_cash, and broadcasts a ``reset`` SSE envelope so live
    subscribers drop their chart buffers and re-render around the new ticker.

    Returns the same shape as ``GET /exchange/state``.
    """
    try:
        payload = await bootstrap_from_yahoo(req.ticker)
    except BootstrapError as exc:
        # Treat invalid / not-found / Yahoo-down as a 422 so the frontend can
        # surface the error inline without retrying as a 5xx.
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await runtime.respawn(payload, personas=agent_swarm.list_personas())
    return runtime.state_payload()


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


@router.get("/agents")
def list_agents() -> list[dict[str, Any]]:
    """Return the live swarm roster — one entry per registered persona.

    The frontend uses this to lay out the Agent Swarm panel (one dot per agent,
    grouped by archetype), to surface persona detail in the swarm-dot hover
    tooltip, and to map order-log entries back to a known cohort. Static at
    app startup; refetched only on a frontend remount.
    """
    return [
        {
            "agent_id": p.agent_id,
            "display_name": p.display_name,
            "archetype": p.archetype.value,
            "risk_tolerance": p.risk_tolerance.value,
            "time_horizon": p.time_horizon.value,
            "tick_period_s": p.tick_period_s,
            "max_order_size": p.max_order_size,
            "backstory": p.backstory,
        }
        for p in agent_swarm.list_personas()
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

    Returns the actual outcome (filled / killed / hold). The submission itself is
    pushed to the SSE order_log stream as a ``source="manual"`` entry — visible
    alongside agent decisions, but with no persona/reasoning attached.
    """
    if abs(req.qty) > 1_000_000:
        raise HTTPException(status_code=400, detail="qty out of range")
    order = Order(agent_id=req.agent_id, limit=float(req.limit), qty=int(req.qty))
    # Broadcast the manual submission first so the order log shows the intent
    # immediately, regardless of whether it eventually fills or kills.
    runtime.record_manual_order(order)
    # Async handler runs on the event loop, so this is naturally serialized
    # with the tick loop — no explicit lock needed.
    result = runtime.exchange.execute_now(order)
    return _serialize_result(result)


@router.get("/stream")
async def stream():
    """
    Server-Sent Events stream multiplexing three event types onto one connection:

    * ``snapshot`` — full Snapshot dict; fires every backend tick
      (5 Hz UI breathe + 1 Hz event ticks, configured in runtime.py).
    * ``order_log`` — one entry per *decision* (BUY/SELL/HOLD or manual order);
      fires immediately when the swarm or HTTP submit produces it.
    * ``reset`` — primed once on connect (so the client learns the current
      ticker/name/fair) and rebroadcast on every ``/exchange/spawn`` call so
      live subscribers drop their chart buffers and re-render around the new
      ticker.

    On connect the client receives ``reset`` → ``snapshot`` → replay of the
    recent order-log buffer, so a late-joining UI renders immediately with
    full context.
    """

    async def event_generator():
        try:
            async for envelope in runtime.stream():
                yield {
                    "event": envelope["event"],
                    "data": json.dumps(envelope["data"]),
                }
        except asyncio.CancelledError:
            # Client disconnected — clean up handled by stream() finally block.
            raise

    return EventSourceResponse(event_generator())
