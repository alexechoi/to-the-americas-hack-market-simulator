"""Types for the exchange: MM params/state, orders, fills, ladder, snapshots, agent accounts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Union


@dataclass(frozen=True)
class MMParams:
    """Market maker parameters. All stable per session."""

    tick: float = 0.01
    vol: float = 0.5  # σ, constant in v1
    half_spread_coef: float = 1.0  # α  (half_spread = max(tick, α·σ))
    kyle_lambda: float = 0.05  # λ  (fair impact per unit signed inside-volume)
    ladder_depth: int = 10
    level_size: int = 10
    size_growth: float = 0.4  # size_i = level_size · (1 + i · size_growth); deeper levels carry more depth

    # cosmetic salt (deterministic per (salt_seed, tick_id))
    size_jitter: float = 0.4
    imbalance: float = 0.3
    gap_prob: float = 0.08
    jumbo_prob: float = 0.05
    jumbo_mult: float = 3.0
    salt_seed: int = 0


@dataclass
class MMState:
    """Mutable MM state. In v1 the only live scalar is `fair`."""

    fair: float


@dataclass
class Account:
    """Mutable per-agent ledger owned by the exchange."""

    agent_id: str
    inventory: int = 0
    cash: float = 0.0
    n_fills: int = 0
    initial_cash: float = 0.0


@dataclass(frozen=True)
class Order:
    """FOK order. qty > 0 buys, qty < 0 sells, qty == 0 holds."""

    agent_id: str
    limit: float
    qty: int


@dataclass(frozen=True)
class Fill:
    agent_id: str
    qty: int  # signed
    vwap: float
    levels: tuple[tuple[float, int], ...]  # [(price, qty), ...] actually touched


@dataclass(frozen=True)
class Killed:
    agent_id: str
    reason: str  # "limit_not_crossed" | "insufficient_liquidity"


@dataclass(frozen=True)
class Hold:
    agent_id: str


OrderResult = Union[Fill, Killed, Hold]


@dataclass(frozen=True)
class Ladder:
    """Bids best-first (descending price); asks best-first (ascending price)."""

    bids: tuple[tuple[float, int], ...]
    asks: tuple[tuple[float, int], ...]


@dataclass(frozen=True)
class AccountSnapshot:
    agent_id: str
    inventory: int
    cash: float
    equity: float  # cash + inventory · fair
    n_fills: int


@dataclass(frozen=True)
class Snapshot:
    tick_id: int  # monotonic, advances every tick (UI + event)
    event_tick: int  # advances only when orders processed
    fair: float
    best_bid: float
    best_ask: float
    mid: float  # = fair
    ladder: Ladder
    recent_trades: tuple[Fill, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class PricePoint:
    """A single (tick_id, fair) sample recorded whenever fair changes.

    The exchange's authoritative timeline is the integer `tick_id`. News headlines,
    agent observations, and the frontend chart all anchor to this — no wall-clock
    leaks into the simulation.
    """

    tick_id: int
    fair: float


@dataclass(frozen=True)
class AgentObservation:
    """Canonical 'what this agent sees right now'. Feeds prompts / policies."""

    market: Snapshot
    account: AccountSnapshot
