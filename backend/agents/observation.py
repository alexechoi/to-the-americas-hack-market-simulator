"""Boundary helpers that build LLM-facing observation objects from the simulation.

Conventions:
    * The exchange owns hot-path dataclasses (`Snapshot`, `AccountSnapshot`).
    * The news bus owns wire-format `NewsHeadline` (with `tick_id` anchors).
    * The agent layer owns LLM-facing pydantic models (`MarketContextView`,
      `AccountView`, `NewsView`, `TraderContext`).

This module is the only place that crosses all three boundaries — keep it small
and free of domain logic so it stays trivial to test.
"""

from __future__ import annotations

from exchange import Exchange
from news import NewsBus

from .schemas import (
    NewsView,
    TraderContext,
    TraderPersona,
)


def build_news_view(
    bus: NewsBus,
    exchange: Exchange,
    *,
    n: int = 5,
) -> list[NewsView]:
    """Project the most recent `n` headlines into the LLM-facing `NewsView` shape.

    `pct_change_since` is computed as the percent move of `fair` between the
    headline's `tick_id` (anchor) and the exchange's current `fair`. Headlines
    that predate any recorded price (shouldn't happen — exchange seeds at 0)
    fall back to 0% so the LLM never sees NaN/None.
    """
    snap = exchange.snapshot()
    now_fair = snap.fair
    out: list[NewsView] = []
    for hl in bus.recent(n=n):
        anchor = exchange.price_at(hl.tick_id)
        if anchor is None or anchor == 0:
            pct = 0.0
        else:
            pct = (now_fair - anchor) / anchor * 100.0
        out.append(
            NewsView(
                headline=hl.headline,
                source=hl.source,
                pct_change_since=pct,
            )
        )
    return out


def build_trader_context(
    *,
    persona: TraderPersona,
    exchange: Exchange,
    news_bus: NewsBus,
    news_limit: int = 5,
) -> TraderContext:
    """One-shot helper: snapshot the world for one persona's turn.

    Equivalent to manually composing `exchange.observe`, `build_news_view`, and
    `TraderContext.build` — kept here so call sites (debug_api, agent loops)
    don't drift apart.
    """
    observation = exchange.observe(persona.agent_id)
    news = build_news_view(news_bus, exchange, n=news_limit)
    return TraderContext.build(persona=persona, observation=observation, news=news)
