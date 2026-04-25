"""Default roster of trader personas spawned at backend startup.

Hand-curated cohort of 15 personas spread across the four archetypes. Each
persona has a distinct risk tolerance, time horizon, cadence, and backstory so
the swarm panel reads as a *crowd* of opinions rather than four template clones.

Cadence guideline (rough seconds between turns; jittered ±20% in `swarm.py`):
    HFT 4–7 | HEDGE_FUND 25–40 | RETAIL 40–70 | PENSION_FUND 120–180
"""

from __future__ import annotations

from .schemas import RiskTolerance, TimeHorizon, TraderArchetype, TraderPersona


def default_roster() -> list[TraderPersona]:
    """Return a fresh 15-persona swarm. Called once at app startup."""
    return [
        # ---- HFT · sub-second algos -------------------------------------
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
            agent_id="hft-02",
            display_name="Vega Arbiter",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=4.0,
            max_order_size=80,
            backstory=(
                "Stat-arb desk runner. Trusts mean-reversion at 1-second "
                "horizons; flattens fast when the spread starts walking."
            ),
        ),
        TraderPersona(
            agent_id="hft-03",
            display_name="Quill Tachyon",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=6.0,
            max_order_size=120,
            backstory=(
                "Momentum-ignition specialist. Front-runs order-flow imbalances, "
                "happy to take heat for two ticks if the tape is one-sided."
            ),
        ),
        TraderPersona(
            agent_id="hft-04",
            display_name="Rho Spreadwell",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=7.0,
            max_order_size=40,
            backstory=(
                "Bank-trained passive market-maker. Quotes both sides of the "
                "book, hates inventory, will pay the spread to stay flat."
            ),
        ),
        # ---- Hedge fund · discretionary minutes -------------------------
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
            agent_id="hf-02",
            display_name="Lena Ostrov",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=35.0,
            max_order_size=200,
            backstory=(
                "Quant equity L/S, factor-aware. Trims winners on RSI extremes, "
                "adds to laggards when cross-sectional momentum reverses."
            ),
        ),
        TraderPersona(
            agent_id="hf-03",
            display_name="Diego Valenzuela",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=25.0,
            max_order_size=400,
            backstory=(
                "Event-driven activist. Front-runs catalyst windows; will build "
                "loud positions on hard news and message the board afterwards."
            ),
        ),
        TraderPersona(
            agent_id="hf-04",
            display_name="Priya Chandran",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=40.0,
            max_order_size=250,
            backstory=(
                "Distressed / special-sits PM. Allergic to consensus; only "
                "deploys when the tape disagrees with her DCF by 20%+."
            ),
        ),
        # ---- Retail · slower app traders --------------------------------
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
            agent_id="retail-02",
            display_name="Carmen Villalobos",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=70.0,
            max_order_size=15,
            backstory=(
                "Reads 10-Ks for fun. Adds on dips when the fundamentals haven't "
                "changed; ignores anything that smells like a meme cycle."
            ),
        ),
        TraderPersona(
            agent_id="retail-03",
            display_name="Tobi Greene",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=45.0,
            max_order_size=30,
            backstory=(
                "WSB-pilled options gambler. Loves 0DTE, leverages on green "
                "headlines, posts loss porn on the bad days. No stop-losses."
            ),
        ),
        TraderPersona(
            agent_id="retail-04",
            display_name="Hiroshi Endo",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=60.0,
            max_order_size=25,
            backstory=(
                "Swing-trader. Trend-follows on multi-day breakouts, exits when "
                "momentum stalls, keeps a tight P&L journal he never re-reads."
            ),
        ),
        # ---- Pension fund · slow long-term allocators -------------------
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
        TraderPersona(
            agent_id="pension-02",
            display_name="Robert Achterberg",
            archetype=TraderArchetype.PENSION_FUND,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=180.0,
            max_order_size=400,
            backstory=(
                "Dividend-aristocrat allocator. Rebalances toward quality on "
                "drawdowns, exits names that cut payouts, tolerates dull months."
            ),
        ),
        TraderPersona(
            agent_id="pension-03",
            display_name="Naomi Bergström",
            archetype=TraderArchetype.PENSION_FUND,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=120.0,
            max_order_size=350,
            backstory=(
                "ESG-mandated long-term holder. Reads sustainability reports the "
                "way others read earnings. Slow to add, slower to sell."
            ),
        ),
    ]


__all__ = ["default_roster"]
