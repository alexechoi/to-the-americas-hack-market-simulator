"""Pydantic schemas for trader agents.

Two boundaries live here:

1. **Spawn / config side** (`TraderArchetype`, `TraderPersona`, `SpawnConfig`) — what the
   orchestrator hands the runtime to bring agents into existence.
2. **Runtime side** (`NewsView`, `MarketContextView`, `AccountView`, `TraderContext`,
   `TraderDecision`) — the data the LLM sees on a turn and the structured action it returns.

Internal exchange types (`exchange/types.py`) stay as dataclasses for hot-path performance.
Wire-format news (`news.NewsHeadline`) lives next to the news bus. This module owns the
LLM-facing boundary and the conversion helpers between the three worlds.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Self
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

from exchange.types import (
    AccountSnapshot,
    AgentObservation,
    Fill,
    Ladder,
    Snapshot,
)
from news import NewsHeadline


# ---------------------------------------------------------------------------
# Spawn / config side
# ---------------------------------------------------------------------------


class TraderArchetype(StrEnum):
    """Coarse personality buckets. Each archetype implies a default prompt + cadence."""

    HFT = "hft"
    RETAIL = "retail"
    HEDGE_FUND = "hedge_fund"
    PENSION_FUND = "pension_fund"


class RiskTolerance(StrEnum):
    AGGRESSIVE = "aggressive"
    MODERATE = "moderate"
    CONSERVATIVE = "conservative"


class TimeHorizon(StrEnum):
    """How far out a trader looks when reasoning about a headline."""

    INTRADAY = "intraday"
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"


class TraderPersona(BaseModel):
    """Static config for one trader. Mutable runtime state lives in the exchange `Account`."""

    model_config = ConfigDict(frozen=True)

    agent_id: str = Field(
        default_factory=lambda: f"agent_{uuid4().hex[:8]}", min_length=1
    )
    display_name: str = Field(min_length=1, max_length=64)
    archetype: TraderArchetype
    risk_tolerance: RiskTolerance = RiskTolerance.MODERATE
    time_horizon: TimeHorizon = TimeHorizon.SHORT_TERM

    tick_period_s: float = Field(
        default=1.0,
        gt=0.0,
        description="Cadence of this agent's decision loop. HFTs tick faster than retail.",
    )
    max_order_size: int = Field(default=100, gt=0)

    backstory: str = Field(
        min_length=1,
        max_length=2_000,
        description="Free-form persona blurb spliced into the system prompt.",
    )
    extra_instructions: str | None = Field(
        default=None,
        max_length=2_000,
        description="Optional additional steering on top of the archetype default.",
    )


class SpawnConfig(BaseModel):
    """Top-level orchestration payload: what universe to instantiate."""

    ticker: str = Field(min_length=1, max_length=16)
    initial_fair: float = Field(gt=0.0)
    personas: list[TraderPersona] = Field(min_length=1)
    seed_news: list[NewsHeadline] = Field(default_factory=list)
    session_seed: int = 0


# ---------------------------------------------------------------------------
# Runtime side — what the LLM sees and emits
# ---------------------------------------------------------------------------


class NewsView(BaseModel):
    """Lean LLM-facing news item: text + freshness + price-move-since-arrival.

    Built lazily at observation time from a wire-format `NewsHeadline` plus the
    exchange's price history, so the LLM never sees the raw `tick_id` anchor.

    Two freshness signals are surfaced together so the LLM can distinguish
    breaking-but-not-yet-priced news from stale-already-digested news:

    * ``seconds_ago``: wall-clock seconds since the headline landed on the bus.
    * ``pct_change_since``: percent move in fair since the headline's anchor.
      Near-zero on a fresh headline means "market hasn't reacted yet" (act
      now); near-zero on a stale one means "non-event" — the renderer in
      ``agents.llm`` flags ``[NEW]`` so the LLM can tell the difference.
    """

    model_config = ConfigDict(frozen=True)

    headline: str
    source: str
    seconds_ago: float = Field(
        ge=0.0,
        description="Wall-clock seconds since this headline was published.",
    )
    pct_change_since: float = Field(
        description="Percent change in fair since this headline's tick_id (e.g. 1.25 = +1.25%).",
    )


class LadderLevelView(BaseModel):
    """Single price level in the ladder, prompt-friendly."""

    model_config = ConfigDict(frozen=True)

    price: float
    size: int


class MarketContextView(BaseModel):
    """Public market state, prompt-friendly. Built from `exchange.Snapshot`."""

    model_config = ConfigDict(frozen=True)

    tick_id: int
    event_tick: int
    fair: float
    best_bid: float
    best_ask: float
    bids: list[LadderLevelView]
    asks: list[LadderLevelView]
    recent_trades: list["TradePrint"] = Field(default_factory=list)

    @classmethod
    def from_snapshot(
        cls, snap: Snapshot, *, recent_trades_limit: int = 10
    ) -> "MarketContextView":
        return cls(
            tick_id=snap.tick_id,
            event_tick=snap.event_tick,
            fair=snap.fair,
            best_bid=snap.best_bid,
            best_ask=snap.best_ask,
            bids=_ladder_side(snap.ladder, side="bids"),
            asks=_ladder_side(snap.ladder, side="asks"),
            recent_trades=[
                TradePrint.from_fill(f)
                for f in snap.recent_trades[-recent_trades_limit:]
            ],
        )


class TradePrint(BaseModel):
    """Compact view of a fill for the recent-trades tape."""

    model_config = ConfigDict(frozen=True)

    agent_id: str
    qty: int
    vwap: float

    @classmethod
    def from_fill(cls, fill: Fill) -> "TradePrint":
        return cls(agent_id=fill.agent_id, qty=fill.qty, vwap=fill.vwap)


class AccountView(BaseModel):
    """The agent's own private ledger view.

    Intentionally omits cash / equity — agents don't see how much capital they have.
    Position-sizing is bounded by the persona's `max_order_size`.
    The exchange still tracks cash/equity on `AccountSnapshot` for accounting + the HTTP API.
    """

    model_config = ConfigDict(frozen=True)

    agent_id: str
    inventory: int
    n_fills: int

    @classmethod
    def from_snapshot(cls, snap: AccountSnapshot) -> "AccountView":
        return cls(
            agent_id=snap.agent_id,
            inventory=snap.inventory,
            n_fills=snap.n_fills,
        )


class TraderContext(BaseModel):
    """Everything the agent sees on a turn. Used as `deps` for the pydantic-ai Agent."""

    model_config = ConfigDict(frozen=True)

    persona: TraderPersona
    market: MarketContextView
    account: AccountView
    news: list[NewsView] = Field(default_factory=list)
    memory: str = Field(
        default="",
        description=(
            "Pre-assembled, token-budgeted recall block from MuBit (lessons + facts "
            "from this persona's past turns and the shared news log). Empty when the "
            "memory layer is disabled or the recall returned nothing."
        ),
    )

    @classmethod
    def build(
        cls,
        *,
        persona: TraderPersona,
        observation: AgentObservation,
        news: list[NewsView] | None = None,
        memory: str = "",
    ) -> "TraderContext":
        return cls(
            persona=persona,
            market=MarketContextView.from_snapshot(observation.market),
            account=AccountView.from_snapshot(observation.account),
            news=list(news or []),
            memory=memory,
        )


class TraderAction(StrEnum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class TraderDecision(BaseModel):
    """Structured output the LLM must produce. Validated via pydantic-ai `output_type`.

    Quantity is always non-negative; `action` carries the sign. `to_signed_qty()` converts
    to the exchange's signed-int convention at the boundary.
    """

    model_config = ConfigDict(frozen=True)

    action: TraderAction
    quantity: int = Field(ge=0, le=1_000_000)
    limit_price: float = Field(gt=0.0)
    confidence: float = Field(ge=0.0, le=1.0, description="Self-rated 0..1 conviction.")
    reasoning: str = Field(
        min_length=1,
        max_length=240,
        description="ONE short sentence (~30 words); surfaced to the UI as a thought bubble.",
    )

    @model_validator(mode="after")
    def _hold_must_have_zero_qty(self) -> Self:
        if self.action is TraderAction.HOLD and self.quantity != 0:
            raise ValueError("quantity must be 0 when action is 'hold'")
        if self.action is not TraderAction.HOLD and self.quantity == 0:
            raise ValueError("quantity must be > 0 for buy/sell")
        return self

    def to_signed_qty(self) -> int:
        match self.action:
            case TraderAction.BUY:
                return self.quantity
            case TraderAction.SELL:
                return -self.quantity
            case TraderAction.HOLD:
                return 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ladder_side(ladder: Ladder, *, side: str) -> list[LadderLevelView]:
    levels = ladder.bids if side == "bids" else ladder.asks
    return [LadderLevelView(price=p, size=s) for p, s in levels]


# Forward-ref resolution for `MarketContextView.recent_trades` and `SpawnConfig.seed_news`.
MarketContextView.model_rebuild()
SpawnConfig.model_rebuild()
