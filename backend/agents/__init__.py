"""Trader agent layer: pydantic schemas + central inference utility."""

from .llm import (
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
    TraderAgent,
    build_trader_agent,
    default_model,
    default_temperature,
    fresh_window_s,
)
from .observation import build_news_view, build_trader_context
from .roster import default_roster
from .schemas import (
    AccountView,
    LadderLevelView,
    MarketContextView,
    NewsHeadline,
    NewsView,
    RiskTolerance,
    SpawnConfig,
    TimeHorizon,
    TradePrint,
    TraderAction,
    TraderArchetype,
    TraderContext,
    TraderDecision,
    TraderPersona,
)

__all__ = [
    "DEFAULT_MODEL",
    "DEFAULT_TEMPERATURE",
    "AccountView",
    "LadderLevelView",
    "MarketContextView",
    "NewsHeadline",
    "NewsView",
    "RiskTolerance",
    "SpawnConfig",
    "TimeHorizon",
    "TradePrint",
    "TraderAction",
    "TraderAgent",
    "TraderArchetype",
    "TraderContext",
    "TraderDecision",
    "TraderPersona",
    "build_news_view",
    "build_trader_agent",
    "build_trader_context",
    "default_model",
    "default_roster",
    "default_temperature",
    "fresh_window_s",
]
