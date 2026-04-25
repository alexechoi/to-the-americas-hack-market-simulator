"""Debug router — exercise the three layers of the stack from the frontend.

Routes:
    GET  /debug/ping       — bare connectivity + env probe (no schemas, no LLM).
    GET  /debug/pydantic   — round-trips known-good and known-bad payloads through the
                              `TraderPersona` and `TraderDecision` schemas to prove validation
                              is wired and behaving (positive case + the negative case where
                              `quantity != 0` for HOLD must raise).
    POST /debug/inference  — runs ONE real `pydantic-ai` Agent turn against the configured
                              `LLM_MODEL` (gateway-only; default `gateway/groq:llama-3.3-70b-versatile`) and returns
                              the validated `TraderDecision`. Pulls live market state from the
                              shared exchange runtime so the model sees a realistic context.

All endpoints are unauthenticated on purpose — the frontend `/debug` page must work
without a Firebase login. Every endpoint returns 200 even on failure (with `ok=false`
and a human-readable `error`) so the UI can render the error inline rather than
needing to parse `HTTPException` shapes.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import logfire
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError

from agents import (
    AccountView,
    MarketContextView,
    NewsHeadline,
    RiskTolerance,
    TimeHorizon,
    TraderAction,
    TraderArchetype,
    TraderContext,
    TraderDecision,
    TraderPersona,
    build_trader_agent,
    default_model,
)
from agents.llm import _ensure_gateway_model
from runtime import runtime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debug", tags=["debug"])


# ---------------------------------------------------------------------------
# /debug/ping — bare connectivity probe
# ---------------------------------------------------------------------------


@router.get("/ping")
def ping() -> dict[str, Any]:
    """Cheapest possible reachability check. Reports which optional providers are wired."""
    return {
        "ok": True,
        "service": "market-sim-backend",
        "environment": os.getenv("ENVIRONMENT", "dev"),
        "llm_model": default_model(),
        "pydantic_ai_gateway_key_present": bool(os.getenv("PYDANTIC_AI_GATEWAY_API_KEY")),
        "logfire_token_present": bool(os.getenv("LOGFIRE_TOKEN")),
    }


# ---------------------------------------------------------------------------
# /debug/pydantic — schema round-trip
# ---------------------------------------------------------------------------


def _sample_persona() -> TraderPersona:
    return TraderPersona(
        agent_id="agent_debug",
        display_name="Debug Persona",
        archetype=TraderArchetype.RETAIL,
        risk_tolerance=RiskTolerance.MODERATE,
        time_horizon=TimeHorizon.SHORT_TERM,
        max_position=500,
        max_order_size=50,
        backstory="A vanilla retail trader used by the /debug endpoint.",
    )


def _sample_decision() -> TraderDecision:
    return TraderDecision(
        action=TraderAction.BUY,
        quantity=10,
        limit_price=101.25,
        confidence=0.7,
        reasoning="Sample buy used by the /debug endpoint to prove validation works.",
    )


@router.get("/pydantic")
def pydantic_roundtrip() -> dict[str, Any]:
    """Validate a known-good persona + decision, then prove a known-bad payload is rejected."""
    persona = _sample_persona()
    decision = _sample_decision()

    invalid_caught = False
    invalid_error: str | None = None
    try:
        # HOLD with non-zero quantity must fail the model_validator.
        TraderDecision(
            action=TraderAction.HOLD,
            quantity=5,
            limit_price=100.0,
            confidence=0.1,
            reasoning="Should never validate.",
        )
    except ValidationError as exc:
        invalid_caught = True
        invalid_error = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
    else:
        logger.warning(
            "Pydantic debug: invalid TraderDecision was *not* caught — schema regression?"
        )

    return {
        "ok": invalid_caught,
        "persona": persona.model_dump(mode="json"),
        "decision": decision.model_dump(mode="json"),
        "negative_case": {
            "caught": invalid_caught,
            "error": invalid_error,
        },
    }


# ---------------------------------------------------------------------------
# /debug/inference — end-to-end LLM call
# ---------------------------------------------------------------------------


class InferenceRequest(BaseModel):
    """Optional knobs for the debug inference call. All fields have safe defaults."""

    archetype: TraderArchetype = TraderArchetype.RETAIL
    headline: str = Field(
        default="NVDA reports record Q4 earnings, beats estimates by 18%.",
        min_length=1,
        max_length=512,
    )
    model: str | None = Field(
        default=None,
        description="Override LLM_MODEL for this call only (provider:model).",
    )
    user_prompt: str = Field(
        default="Decide your next action based on the latest headline and market state.",
        min_length=1,
        max_length=1_000,
    )


@router.post("/inference")
async def debug_inference(req: InferenceRequest | None = None) -> dict[str, Any]:
    """Run one real Agent turn and return the validated TraderDecision."""
    request = req or InferenceRequest()
    model = _ensure_gateway_model(request.model or default_model())

    persona = _sample_persona().model_copy(update={"archetype": request.archetype})
    headline = NewsHeadline(source="debug", headline=request.headline)

    observation = runtime.exchange.observe(persona.agent_id)
    context = TraderContext(
        persona=persona,
        market=MarketContextView.from_snapshot(observation.market),
        account=AccountView.from_snapshot(observation.account),
        news=[headline],
    )

    started = time.perf_counter()
    try:
        with logfire.span("debug_inference", model=model, agent_id=persona.agent_id):
            agent = build_trader_agent(model=model)
            result = await agent.run(request.user_prompt, deps=context)
        decision: TraderDecision = result.output
        latency_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "debug_inference ok model=%s latency_ms=%.1f action=%s qty=%d",
            model,
            latency_ms,
            decision.action.value,
            decision.quantity,
        )
        return {
            "ok": True,
            "model": model,
            "latency_ms": round(latency_ms, 1),
            "decision": decision.model_dump(mode="json"),
            "context": {
                "fair": context.market.fair,
                "best_bid": context.market.best_bid,
                "best_ask": context.market.best_ask,
                "headline": headline.headline,
            },
        }
    except Exception as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        logger.exception("debug_inference failed model=%s", model)
        return {
            "ok": False,
            "model": model,
            "latency_ms": round(latency_ms, 1),
            "error": f"{type(exc).__name__}: {exc}",
            "hint": _inference_hint(model, exc),
        }


def _inference_hint(model: str, exc: Exception) -> str:
    """Human-friendly suggestion based on the model string + error message."""
    msg = str(exc).lower()
    if model.startswith("gateway/"):
        if "api_key" in msg or "api key" in msg or "gateway" in msg or "unauthorized" in msg:
            return "Set PYDANTIC_AI_GATEWAY_API_KEY in backend/.env (gateway model string)."
        return "Gateway model string detected (prefix gateway/). Check PYDANTIC_AI_GATEWAY_API_KEY and backend logs."

    provider = model.split(":", 1)[0] if ":" in model else model
    if "model" in msg and "not found" in msg:
        return f"Model id '{model}' is unknown to provider '{provider}'."
    return "Non-gateway model string detected. Use a gateway/... model string and check backend logs."
