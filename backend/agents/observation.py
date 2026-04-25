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
from news import SECONDS_PER_TICK, NewsBus

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

    For each headline we surface two freshness signals so the prompt can
    distinguish breaking news from already-digested news:

    * ``seconds_ago``: ``(current_tick - headline.tick_id) * SECONDS_PER_TICK``,
      clamped at 0 — new headlines stamped on the same tick read as 0.0s old.
    * ``pct_change_since``: percent move in ``fair`` between the headline's
      anchor tick and now. Headlines that predate any recorded price
      (shouldn't happen — exchange seeds at tick 0) fall back to 0%.
    """
    snap = exchange.snapshot()
    now_fair = snap.fair
    now_tick = exchange.current_tick_id
    out: list[NewsView] = []
    for hl in bus.recent(n=n):
        anchor = exchange.price_at(hl.tick_id)
        if anchor is None or anchor == 0:
            pct = 0.0
        else:
            pct = (now_fair - anchor) / anchor * 100.0
        ticks_since = max(0, now_tick - hl.tick_id)
        out.append(
            NewsView(
                headline=hl.headline,
                source=hl.source,
                seconds_ago=ticks_since * SECONDS_PER_TICK,
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
    memory: str = "",
) -> TraderContext:
    """One-shot helper: snapshot the world for one persona's turn.

    Equivalent to manually composing `exchange.observe`, `build_news_view`, and
    `TraderContext.build` — kept here so call sites (debug_api, agent loops)
    don't drift apart.

    ``memory`` is the pre-assembled MuBit recall block (lessons + recent
    activity); pass it in pre-recalled because retrieval is async-bounded and
    this helper stays sync. Defaults to "" so non-memory call sites
    (e.g. ``debug_api``) don't have to plumb it through.
    """
    observation = exchange.observe(persona.agent_id)
    news = build_news_view(news_bus, exchange, n=news_limit)
    return TraderContext.build(
        persona=persona, observation=observation, news=news, memory=memory
    )
