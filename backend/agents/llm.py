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

from .schemas import (
    NewsView,
    TraderArchetype,
    TraderContext,
    TraderDecision,
    TraderPersona,
)

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
    "Each turn you receive THREE inputs, in priority order:\n"
    "  (1) RECENT NEWS — headlines that may move price. Treat these as your "
    "PRIMARY decision driver, especially headlines tagged [NEW] (just published, "
    "market has not yet repriced them). Stale headlines (pct_change_since well "
    "above zero) are already partly digested; new headlines are not.\n"
    "  (2) Public market state — fair, best_bid, best_ask, ladder, recent prints.\n"
    "  (3) Your private account — current inventory and number of fills "
    "(you do NOT see cash or P&L; size by lots, not by dollars).\n\n"
    "DECISION POLICY: when a [NEW] headline is bullish for the asset, lean toward "
    "buy; when bearish, lean toward sell — adjusted by your persona's risk and "
    "horizon. 'hold' is appropriate when there is no fresh news AND the ladder "
    "shows no clear edge. Do NOT default to 'hold' just because nothing changed "
    "since last tick — re-read the news.\n\n"
    "Emit a TraderDecision with EXACTLY these fields:\n"
    "  - action: 'buy', 'sell', or 'hold' — pick exactly one.\n"
    "  - quantity: 0 if action is 'hold'; otherwise a positive integer near 50 lots "
    "(this is the standard size every agent in this market uses). Stay close to ~50 "
    "across turns; never exceed your max_order_size and never go above max_position "
    "after the fill.\n"
    "  - limit_price: a positive number set so the order is marketable and crosses "
    "the spread immediately:\n"
    "      * If action is 'buy', set limit_price = market.best_ask (lift the offer).\n"
    "      * If action is 'sell', set limit_price = market.best_bid (hit the bid).\n"
    "      * If action is 'hold', set limit_price = market.fair (it is unused).\n"
    "  - confidence: your self-rated conviction in [0.0, 1.0]. Bump higher when a "
    "[NEW] headline directly supports your action; lower when you are reading "
    "noise or fading a stale move.\n"
    "  - reasoning: ONE short sentence (≤ 240 chars, ~30 words) in your persona's "
    "voice — this is rendered to humans as a thought bubble, so be concise and "
    "in-character. If a headline drove the call, NAME it (e.g. 'Lifting on the "
    "earnings beat headline').\n\n"
    "Do not output multi-paragraph reasoning."
)

# Freshness window. A headline counts as ``[NEW]`` for a persona if it landed
# within the last (tick_period_s × this multiplier) seconds — i.e. roughly the
# persona's last two-and-a-half turns. Wider for slow personas (PENSION at 15s
# tick → ~37s window) than for fast ones (HFT at 0.5s → ~1.25s) so every
# persona gets at least one or two looks at a breaking headline before it
# starts showing as stale.
_FRESH_TICK_MULTIPLIER = 2.5


def fresh_window_s(persona: TraderPersona) -> float:
    """Wall-clock seconds during which a headline is rendered ``[NEW]`` for ``persona``.

    Public so the swarm logging path can classify the same way the prompt does.
    """
    return persona.tick_period_s * _FRESH_TICK_MULTIPLIER

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


def _format_news_line(idx: int, n: NewsView, *, fresh_window_s: float) -> str:
    """One-line render of a NewsView with a [NEW]/[STALE] freshness flag.

    Fresh headlines (``seconds_ago < fresh_window_s``) get a ``[NEW]`` tag and
    suppress the misleading ``pct_change_since`` (which reads near 0% for
    just-published headlines and would otherwise signal "no impact" to the LLM).
    Stale headlines keep the ``pct_change_since`` so the LLM can see how much
    of the move has already played out.
    """
    is_fresh = n.seconds_ago < fresh_window_s
    age = f"{n.seconds_ago:.1f}s ago"
    if is_fresh:
        suffix = f"[NEW · {age} · market not yet repriced]"
    else:
        suffix = f"[STALE · {age} · fair {n.pct_change_since:+.2f}% since]"
    return f"  [{idx}] {suffix} {n.source}: {n.headline}"


def _runtime_block(ctx: TraderContext) -> str:
    """Render the live news / market / account state into the system prompt.

    Pydantic-AI does not auto-serialize ``deps`` into the LLM prompt — they are
    only accessible from tools and ``@instructions`` decorators. Without this
    block the model would never see best_bid / best_ask / fair / ladder and
    would hallucinate price levels (typically near round numbers like 100).

    News is rendered FIRST (above market state) and tagged ``[NEW]`` /
    ``[STALE]`` so the LLM treats fresh headlines as the primary decision
    driver — see ``_BASE_INSTRUCTIONS``. The ordering also matters
    behaviourally: prior layout had news at the bottom, immediately followed
    by a strong "REMINDER: copy best_ask into limit_price" — the model
    visibly anchored on that reminder and ignored news.
    """
    persona = ctx.persona
    market = ctx.market
    account = ctx.account
    news = ctx.news

    window_s = fresh_window_s(persona)

    if news:
        news_lines = "\n".join(
            _format_news_line(i, n, fresh_window_s=window_s)
            for i, n in enumerate(news, start=1)
        )
    else:
        news_lines = "  (no recent headlines — base your call on market microstructure)"

    # Memory block goes ABOVE news so the LLM treats prior lessons + your own
    # recent reasoning as a frame for interpreting the latest headlines, not
    # an afterthought. Suppressed entirely when MuBit is disabled or the recall
    # returned nothing — we don't want a "(none)" line eating prompt tokens.
    memory_block = (
        f"=== Memory (lessons + recent activity) ===\n{ctx.memory.strip()}\n\n"
        if ctx.memory.strip()
        else ""
    )

    bid_lines = (
        "\n".join(f"  {lvl.price:.4f} x {lvl.size}" for lvl in market.bids[:5])
        or "  (empty)"
    )
    ask_lines = (
        "\n".join(f"  {lvl.price:.4f} x {lvl.size}" for lvl in market.asks[:5])
        or "  (empty)"
    )
    if market.recent_trades:
        prints = "\n".join(
            f"  {p.agent_id} {'BUY' if p.qty > 0 else 'SELL'} {abs(p.qty)} @ {p.vwap:.4f}"
            for p in market.recent_trades[-5:]
        )
    else:
        prints = "  (none yet)"

    return (
        f"{memory_block}"
        f"=== Recent News (newest first) ===\n{news_lines}\n\n"
        f"=== Market State (tick {market.tick_id}, event_tick {market.event_tick}) ===\n"
        f"fair: {market.fair:.4f}\n"
        f"best_bid: {market.best_bid:.4f}\n"
        f"best_ask: {market.best_ask:.4f}\n\n"
        f"Top bids (price x size):\n{bid_lines}\n\n"
        f"Top asks (price x size):\n{ask_lines}\n\n"
        f"Recent prints (newest last):\n{prints}\n\n"
        f"=== Your Account ===\n"
        f"agent_id: {account.agent_id}\n"
        f"inventory: {account.inventory}\n"
        f"n_fills: {account.n_fills}\n\n"
        f"REMINDER: weigh [NEW] news first, then microstructure. For limit_price "
        f"copy market.best_ask on buy, market.best_bid on sell. Do not invent a price."
    )


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

    @agent.instructions
    def _runtime_instructions(ctx: RunContext[TraderContext]) -> str:
        return _runtime_block(ctx.deps)

    return agent


def build_trader_agent(*, model: str | None = None) -> TraderAgent:
    """Return a pydantic-ai Agent ready to call `.run("...", deps=trader_context)`.

    The Agent itself is cached per model string (Agents are stateless); the persona
    is supplied via `TraderContext.persona` on each `.run` call.

    Pass `model="gateway/anthropic:claude-sonnet-4-6"` (or any other pydantic-ai-supported
    gateway model string) to override the default for hero personas.
    """
    return _trader_agent_for_model(_ensure_gateway_model(model or default_model()))
