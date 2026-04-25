"""Default roster of trader personas spawned at backend startup.

The first scaffolding pass keeps this short and hand-curated — one persona per
archetype, with archetype-appropriate ``tick_period_s``. Tweak freely; the swarm
runtime simply iterates ``default_roster()`` and registers each persona.

Cadence guideline (rough seconds between turns):
    HFT 0.5  | MARKET_MAKER 1.0 | QUANT 2.0
    HEDGE_FUND 3.0 | RETAIL 5.0 | PENSION_FUND 15.0
"""

from __future__ import annotations

from .schemas import RiskTolerance, TimeHorizon, TraderArchetype, TraderPersona


def default_roster() -> list[TraderPersona]:
    """Return one fresh persona per archetype. Called once at app startup."""
    return [
        TraderPersona(
            agent_id="hft-01",
            display_name="Nyx Latency",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=0.5,
            max_position=500,
            max_order_size=50,
            initial_cash=250_000.0,
            backstory=(
                "Ex-options market-maker turned solo HFT. Lives in the spread, "
                "scalps imbalances, never carries a position past the close."
            ),
        ),
        TraderPersona(
            agent_id="mm-01",
            display_name="Regina Spread",
            archetype=TraderArchetype.MARKET_MAKER,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=1.0,
            max_position=2000,
            max_order_size=200,
            initial_cash=500_000.0,
            backstory=(
                "Quotes both sides of the book for a living. Skews on inventory, "
                "fades aggressors who lift through the mid."
            ),
        ),
        TraderPersona(
            agent_id="quant-01",
            display_name="Petra Sigma",
            archetype=TraderArchetype.QUANT,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=2.0,
            max_position=1500,
            max_order_size=150,
            initial_cash=400_000.0,
            backstory=(
                "Statistical-arb shop alum. Takes only trades with measurable edge; "
                "back-of-envelopes expected value before every order."
            ),
        ),
        TraderPersona(
            agent_id="hf-01",
            display_name="Marcus Kessler",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=3.0,
            max_position=3000,
            max_order_size=300,
            initial_cash=1_000_000.0,
            backstory=(
                "Discretionary macro PM. Goes contrarian when sentiment overshoots, "
                "sizes hard into convictions, tolerates drawdown for thesis."
            ),
        ),
        TraderPersona(
            agent_id="retail-01",
            display_name="Jamie Yolo",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=5.0,
            max_position=200,
            max_order_size=20,
            initial_cash=20_000.0,
            backstory=(
                "App-trader. Buys headlines, panics on red candles, occasionally "
                "right for the wrong reasons. FOMO-sensitive."
            ),
        ),
        TraderPersona(
            agent_id="pension-01",
            display_name="Eleanor Vance",
            archetype=TraderArchetype.PENSION_FUND,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=15.0,
            max_position=5000,
            max_order_size=500,
            initial_cash=2_000_000.0,
            backstory=(
                "Allocates retirement capital. Ignores intraday noise, only reacts "
                "when news changes the multi-year cash-flow story."
            ),
        ),
    ]


__all__ = ["default_roster"]
