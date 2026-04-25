"""Default roster of trader personas spawned at backend startup.

The first scaffolding pass keeps this short and hand-curated — one persona per
archetype, with archetype-appropriate ``tick_period_s``. Tweak freely; the swarm
runtime simply iterates ``default_roster()`` and registers each persona.

Cadence guideline (rough seconds between turns):
    HFT 5 | HEDGE_FUND 30 | RETAIL 50 | PENSION_FUND 150
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
            tick_period_s=5.0,
            max_order_size=50,
            backstory=(
                "Ex-options market-maker turned solo HFT. Lives in the spread, "
                "scalps imbalances, never carries a position past the close."
            ),
        ),
        TraderPersona(
            agent_id="hf-01",
            display_name="Marcus Kessler",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=30.0,
            max_order_size=300,
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
            tick_period_s=50.0,
            max_order_size=20,
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
            tick_period_s=150.0,
            max_order_size=500,
            backstory=(
                "Allocates retirement capital. Ignores intraday noise, only reacts "
                "when news changes the multi-year cash-flow story."
            ),
        ),
    ]


__all__ = ["default_roster"]
