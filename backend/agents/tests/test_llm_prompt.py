"""Guard against the regression where market state never reaches the LLM.

Pydantic-AI does not auto-serialize ``deps`` into the prompt — runtime context
must be rendered through an ``@agent.instructions`` decorator. If that wiring
ever breaks, agents start hallucinating prices (typically near $100). These
tests assert that ``_runtime_block`` actually contains the live market / account
/ news values from the ``TraderContext``.
"""

from __future__ import annotations

from agents.llm import _persona_block, _runtime_block
from agents.schemas import (
    AccountView,
    LadderLevelView,
    MarketContextView,
    NewsView,
    RiskTolerance,
    TimeHorizon,
    TradePrint,
    TraderArchetype,
    TraderContext,
    TraderPersona,
)


def _persona() -> TraderPersona:
    return TraderPersona(
        agent_id="agent_test",
        display_name="Tester",
        archetype=TraderArchetype.RETAIL,
        risk_tolerance=RiskTolerance.MODERATE,
        time_horizon=TimeHorizon.SHORT_TERM,
        max_position=500,
        max_order_size=50,
        backstory="Synthetic persona used by prompt-rendering tests.",
    )


def _market(*, fair: float, best_bid: float, best_ask: float) -> MarketContextView:
    return MarketContextView(
        tick_id=42,
        event_tick=7,
        fair=fair,
        best_bid=best_bid,
        best_ask=best_ask,
        bids=[
            LadderLevelView(price=best_bid, size=15),
            LadderLevelView(price=best_bid - 0.01, size=11),
        ],
        asks=[
            LadderLevelView(price=best_ask, size=31),
            LadderLevelView(price=best_ask + 0.01, size=20),
        ],
        recent_trades=[
            TradePrint(agent_id="agent_xyz", qty=5, vwap=fair),
            TradePrint(agent_id="agent_abc", qty=-3, vwap=fair),
        ],
    )


def _account() -> AccountView:
    return AccountView(agent_id="agent_test", inventory=10, n_fills=4)


def _ctx(
    *, fair: float = 208.85, best_bid: float = 207.77, best_ask: float = 208.83
) -> TraderContext:
    return TraderContext(
        persona=_persona(),
        market=_market(fair=fair, best_bid=best_bid, best_ask=best_ask),
        account=_account(),
        news=[
            NewsView(headline="Earnings beat", source="yahoo", pct_change_since=1.25)
        ],
    )


def test_runtime_block_includes_live_prices():
    block = _runtime_block(_ctx())
    # The exact numbers must appear so the LLM can copy them into limit_price.
    assert "208.8500" in block  # fair
    assert "207.7700" in block  # best_bid
    assert "208.8300" in block  # best_ask


def test_runtime_block_includes_ladder_levels():
    block = _runtime_block(_ctx())
    assert "Top bids" in block
    assert "Top asks" in block
    # Sizes from the ladder fixture
    assert "x 15" in block
    assert "x 31" in block


def test_runtime_block_includes_account_state():
    block = _runtime_block(_ctx())
    assert "agent_test" in block
    assert "inventory: 10" in block
    assert "n_fills: 4" in block
    # Cash and equity must NOT leak — agents size by lots, not dollars.
    assert "cash" not in block.lower()
    assert "equity" not in block.lower()


def test_runtime_block_includes_news_with_pct_anchor():
    block = _runtime_block(_ctx())
    assert "Earnings beat" in block
    assert "+1.25%" in block


def test_runtime_block_reminds_to_copy_prices():
    """Belt-and-braces nudge against the LLM inventing round-number prices."""
    block = _runtime_block(_ctx())
    assert "best_ask" in block
    assert "best_bid" in block


def test_persona_block_still_renders_persona_metadata():
    block = _persona_block(_persona())
    assert "Tester" in block
    assert "retail" in block
    assert "Max order size: 50" in block
