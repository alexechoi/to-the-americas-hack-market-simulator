"""Centralised LLM inference utility (gateway-only).

Single source of truth for picking a model and constructing a trader-shaped
`pydantic_ai.Agent`. **All agent code in the repo must go through `build_trader_agent`
and `default_model` — never instantiate `Agent` or a `*Model` class directly.**

Why this exists:
    * One place to swap models/providers via the PydanticAI gateway.
    * Agents are stateless — caching one `Agent` per model string keeps Pydantic-AI's
      schema warm-up out of every trader turn (matters when ~100 personas tick fast).
    * Persona personality is injected via dynamic `@agent.instructions` from
      `RunContext[TraderContext]`, so the cache stays stable across every persona.
    * Logfire instrumentation is wired globally in `observability.configure_observability`
      — every `agent.run(...)` is traced automatically (messages, tools, latency, tokens).

Default model: Gateway-backed Groq Llama 3.3 70B (fast + cheap).
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from pydantic_ai import Agent, RunContext

from .schemas import TraderArchetype, TraderContext, TraderDecision, TraderPersona

logger = logging.getLogger(__name__)

TraderAgent = Agent[TraderContext, TraderDecision]

DEFAULT_MODEL = "gateway/groq:llama-3.3-70b-versatile"


def _ensure_gateway_model(model: str) -> str:
    """Force all model strings through the gateway.

    We intentionally do not support direct provider models like `groq:...`; local dev
    should behave like prod where the gateway key is the single required credential.
    """
    m = (model or "").strip()
    if not m:
        return DEFAULT_MODEL
    if m.startswith("gateway/"):
        return m
    return f"gateway/{m}"


def default_model() -> str:
    """Return the model identifier for new agents. Override via `LLM_MODEL` env var.

    Format follows pydantic-ai's `provider:model` convention. Examples:
        * `gateway/groq:llama-3.3-70b-versatile`  (default; fast, cheap)
        * `gateway/groq:llama-3.1-8b-instant`     (even faster, smaller)
        * `gateway/anthropic:claude-sonnet-4-6`   (slow + smart, for hero personas)
        * `gateway/openai:gpt-5.2`                (fallback)
    """
    return _ensure_gateway_model(os.getenv("LLM_MODEL", DEFAULT_MODEL))


_BASE_INSTRUCTIONS = (
    "You are a trader operating in a simulated single-asset market. "
    "Each turn you receive: (a) public market state — fair, best bid/ask, ladder, "
    "recent prints; (b) your private account — inventory, cash, equity; "
    "(c) a list of recent news headlines. "
    "You must output a structured TraderDecision: action (buy / sell / hold), "
    "non-negative quantity, limit price, self-rated confidence (0..1), and a one-paragraph "
    "reasoning trace that reflects your persona's perspective. "
    "Honour your max_order_size and max_position. The reasoning is shown to humans as a "
    "thought bubble — keep it concise and in-character."
)

_ARCHETYPE_NUDGES: dict[TraderArchetype, str] = {
    TraderArchetype.HFT: (
        "You react in microseconds to micro-structure: ladder imbalance, recent prints, "
        "spread compression. You rarely hold inventory overnight; you scalp small edges."
    ),
    TraderArchetype.RETAIL: (
        "You're a retail investor. News headlines and recent price action drive you "
        "more than fundamentals. You're prone to FOMO on big moves and panic on red candles."
    ),
    TraderArchetype.HEDGE_FUND: (
        "You hunt mispricing. You go contrarian when sentiment overshoots and you size "
        "into convictions. You weigh news against your prior thesis."
    ),
    TraderArchetype.PENSION_FUND: (
        "You allocate slow capital. You ignore intraday noise and only react to news that "
        "changes the multi-year cash-flow story. You prefer holding through volatility."
    ),
    TraderArchetype.TECH_SPECIALIST: (
        "You have deep domain knowledge in the underlying tech. You can tell hype from "
        "substance in product / earnings / regulatory headlines that move tech names."
    ),
    TraderArchetype.QUANT: (
        "You think in signals and statistics. You back-of-envelope expected value before "
        "every order; you don't take trades without a measurable edge."
    ),
    TraderArchetype.MARKET_MAKER: (
        "You quote both sides of the book and earn the spread. You skew based on "
        "inventory and recent flow, not directional views."
    ),
}


def _persona_block(persona: TraderPersona) -> str:
    """Build the dynamic per-turn instruction block from a persona."""
    parts = [
        f"You are {persona.display_name} ({persona.archetype.value}).",
        f"Risk tolerance: {persona.risk_tolerance.value}. Time horizon: {persona.time_horizon.value}.",
        f"Max order size: {persona.max_order_size}. Max position: {persona.max_position}.",
        _ARCHETYPE_NUDGES[persona.archetype],
        f"Backstory: {persona.backstory}",
    ]
    if persona.extra_instructions:
        parts.append(persona.extra_instructions)
    return "\n".join(parts)


@lru_cache(maxsize=8)
def _trader_agent_for_model(model: str) -> TraderAgent:
    """One shared Agent per model — persona is injected via deps at run time."""
    logger.info("Constructing trader Agent for model=%s", model)
    agent: TraderAgent = Agent(
        model,
        deps_type=TraderContext,
        output_type=TraderDecision,
        instructions=_BASE_INSTRUCTIONS,
    )

    @agent.instructions
    def _persona_instructions(ctx: RunContext[TraderContext]) -> str:
        return _persona_block(ctx.deps.persona)

    return agent


def build_trader_agent(*, model: str | None = None) -> TraderAgent:
    """Return a pydantic-ai Agent ready to call `.run("...", deps=trader_context)`.

    The Agent itself is cached per model string (Agents are stateless); the persona
    is supplied via `TraderContext.persona` on each `.run` call.

    Pass `model="gateway/anthropic:claude-sonnet-4-6"` (or any other pydantic-ai-supported
    gateway model string) to override the default for hero personas.
    """
    return _trader_agent_for_model(_ensure_gateway_model(model or default_model()))
