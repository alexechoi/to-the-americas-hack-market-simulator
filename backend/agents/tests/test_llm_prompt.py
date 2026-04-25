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
    *,
    fair: float = 208.85,
    best_bid: float = 207.77,
    best_ask: float = 208.83,
    news: list[NewsView] | None = None,
    memory: str = "",
) -> TraderContext:
    if news is None:
        # Default: a single STALE headline (10s ago, persona tick=1.0s ⇒ fresh
        # window 2.5s) so the historical "+1.25% since" rendering still appears.
        news = [
            NewsView(
                headline="Earnings beat",
                source="yahoo",
                seconds_ago=10.0,
                pct_change_since=1.25,
            )
        ]
    return TraderContext(
        persona=_persona(),
        market=_market(fair=fair, best_bid=best_bid, best_ask=best_ask),
        account=_account(),
        news=news,
        memory=memory,
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
    """Stale headlines keep the ``pct_change_since`` so the LLM sees how much
    of the move has already played out."""
    block = _runtime_block(_ctx())
    assert "Earnings beat" in block
    assert "+1.25%" in block
    assert "[STALE" in block


def test_runtime_block_renders_news_above_market_state():
    """News must appear before market state so the LLM weighs it first.

    Earlier layout buried news at the bottom right above a strong "copy
    best_ask into limit_price" reminder; the model anchored on the reminder
    and ignored news. Guard against regression to that ordering.
    """
    block = _runtime_block(_ctx())
    news_idx = block.index("Recent News")
    market_idx = block.index("Market State")
    assert news_idx < market_idx, (
        "News must render before market state; got news at "
        f"{news_idx}, market at {market_idx}"
    )


def test_runtime_block_flags_fresh_headlines_as_new():
    """Fresh headlines (seconds_ago < persona.tick_period_s × 2.5) must be
    tagged [NEW] AND must NOT show the misleading near-zero pct_change_since.

    Persona tick_period_s defaults to 1.0s ⇒ fresh window = 2.5s; a 0.5s-old
    headline sits comfortably inside it.
    """
    fresh = NewsView(
        headline="Fed cuts rates 50bp",
        source="reuters",
        seconds_ago=0.5,
        pct_change_since=0.0,
    )
    block = _runtime_block(_ctx(news=[fresh]))
    assert "Fed cuts rates 50bp" in block
    assert "[NEW" in block
    # Fresh news must NOT show the misleading "+0.00%" since-anchor — that
    # was the original signal that made LLMs treat breaking news as noise.
    assert "+0.00%" not in block
    assert "market not yet repriced" in block


def test_runtime_block_handles_empty_news():
    block = _runtime_block(_ctx(news=[]))
    assert "no recent headlines" in block


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


def test_runtime_block_renders_memory_above_news():
    """When MuBit returns a recall block, it must appear before news so the
    LLM treats prior lessons as a frame for interpreting the latest headlines.
    The label and the recalled text must both be present."""
    block = _runtime_block(
        _ctx(memory="LESSON: bullish earnings headlines historically lift fair ~1%.")
    )
    assert "Memory (lessons + recent activity)" in block
    assert "LESSON: bullish earnings headlines" in block
    mem_idx = block.index("Memory (lessons")
    news_idx = block.index("Recent News")
    assert mem_idx < news_idx, (
        f"Memory must render before news; got memory at {mem_idx}, news at {news_idx}"
    )


def test_runtime_block_omits_memory_section_when_empty():
    """Empty memory must NOT render an empty section header — every prompt
    token costs latency and money. Memory is opt-in based on recall result."""
    block = _runtime_block(_ctx(memory=""))
    assert "Memory (lessons" not in block

    block_ws = _runtime_block(_ctx(memory="   \n  "))
    assert "Memory (lessons" not in block_ws
