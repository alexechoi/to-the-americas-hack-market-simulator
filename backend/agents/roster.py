"""Default roster of trader personas spawned at backend startup.

Hand-curated cohort of 35 personas spread across the four archetypes. Each
persona has a distinct risk tolerance, time horizon, cadence, and backstory so
the swarm panel reads as a *crowd* of opinions rather than four template clones.

Cadence guideline (rough seconds between turns; jittered ±20% in `swarm.py`):
    HFT 4–8 | HEDGE_FUND 25–45 | RETAIL 40–80 | PENSION_FUND 120–220
"""

from __future__ import annotations

from .schemas import RiskTolerance, TimeHorizon, TraderArchetype, TraderPersona


def default_roster() -> list[TraderPersona]:
    """Return a fresh 35-persona swarm. Called once at app startup."""
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
        TraderPersona(
            agent_id="hft-05",
            display_name="Astra Pinpoint",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=8.0,
            max_order_size=60,
            backstory=(
                "Sell-side execution algo. Schedules child orders on a VWAP "
                "track, refuses to chase, prefers a missed fill over slippage."
            ),
        ),
        TraderPersona(
            agent_id="hft-06",
            display_name="Korbin Slipstream",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=4.0,
            max_order_size=150,
            backstory=(
                "Latency-arb cowboy. Fades stale quotes the millisecond a "
                "correlated venue moves. Pure tape-reader, no fundamentals."
            ),
        ),
        TraderPersona(
            agent_id="hft-07",
            display_name="Pixel Vorhees",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=5.0,
            max_order_size=90,
            backstory=(
                "Toxicity-aware MM. Detects icebergs and informed flow, widens "
                "or pulls quotes when the book turns one-sided."
            ),
        ),
        TraderPersona(
            agent_id="hft-08",
            display_name="Mei Tran",
            archetype=TraderArchetype.HFT,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=6.0,
            max_order_size=100,
            backstory=(
                "ETF / basket-arb specialist. Trades creation-redemption gaps "
                "between the index and its constituents; never carries deltas."
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
        TraderPersona(
            agent_id="hf-05",
            display_name="Soren Bjornsson",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=32.0,
            max_order_size=275,
            backstory=(
                "Global-macro short-vol PM. Sells rallies into euphoria, buys "
                "panic; quotes Soros and sleeps four hours a night."
            ),
        ),
        TraderPersona(
            agent_id="hf-06",
            display_name="Aiyana Crowe",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=38.0,
            max_order_size=180,
            backstory=(
                "Convertible / merger-arb PM. Hunts tiny spreads with hard "
                "deadlines, sizes precisely, refuses to hold un-hedged risk."
            ),
        ),
        TraderPersona(
            agent_id="hf-07",
            display_name="Yuto Sakamoto",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=28.0,
            max_order_size=350,
            backstory=(
                "Asia-session L/S trader. Trades the overnight gap — fades "
                "Western consensus, scales out before the US open."
            ),
        ),
        TraderPersona(
            agent_id="hf-08",
            display_name="Tobias Wreed",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=33.0,
            max_order_size=320,
            backstory=(
                "Forensic short-seller. Reads footnotes, smells fraud in "
                "deferred-revenue trends, publishes thesis decks before sizing."
            ),
        ),
        TraderPersona(
            agent_id="hf-09",
            display_name="Imani Adeyemi",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=36.0,
            max_order_size=380,
            backstory=(
                "EM macro PM. Trades policy surprises and currency cracks; "
                "confident sizing into central-bank meetings, fast to flip."
            ),
        ),
        TraderPersona(
            agent_id="hf-10",
            display_name="Linus Hall",
            archetype=TraderArchetype.HEDGE_FUND,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=45.0,
            max_order_size=220,
            backstory=(
                "Long-vol tail-risk PM. Bleeds quietly in calm tape, scales "
                "into convex payoffs when realised vol cracks the regime."
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
        TraderPersona(
            agent_id="retail-05",
            display_name="Bernie Klausmeyer",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=75.0,
            max_order_size=10,
            backstory=(
                "Retired engineer. DRIPs his dividends, ignores price quotes "
                "between coffee and the morning paper, sells nothing."
            ),
        ),
        TraderPersona(
            agent_id="retail-06",
            display_name="Kayla Ríos",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=42.0,
            max_order_size=35,
            backstory=(
                "TikTok finfluencer follower. Buys whatever a 22-year-old in a "
                "Lambo posted this morning. Stop-loss is 'pray.'"
            ),
        ),
        TraderPersona(
            agent_id="retail-07",
            display_name="Ahmed Yilmaz",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.SHORT_TERM,
            tick_period_s=55.0,
            max_order_size=20,
            backstory=(
                "Self-taught chartist. Lives on Fibonacci levels and RSI "
                "divergences; cuts losers fast, lets winners drift to a target."
            ),
        ),
        TraderPersona(
            agent_id="retail-08",
            display_name="Greta Whitmore",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=80.0,
            max_order_size=12,
            backstory=(
                "Index-DCA disciple. Buys a fixed amount on payday, never sells, "
                "deletes the brokerage app between top-ups."
            ),
        ),
        TraderPersona(
            agent_id="retail-09",
            display_name="Vince Cabrera",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            time_horizon=TimeHorizon.INTRADAY,
            tick_period_s=40.0,
            max_order_size=40,
            backstory=(
                "Full-time day-trader. Six monitors, energy drinks, scalps "
                "intraday breakouts; flat by the close most days, broke some weeks."
            ),
        ),
        TraderPersona(
            agent_id="retail-10",
            display_name="Rosa Pham",
            archetype=TraderArchetype.RETAIL,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=65.0,
            max_order_size=18,
            backstory=(
                "Newsletter follower. Buys whatever Motley Fool flagged this "
                "month, holds for 'the long term', sells when bored."
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
        TraderPersona(
            agent_id="pension-04",
            display_name="Margaret Holloway",
            archetype=TraderArchetype.PENSION_FUND,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=200.0,
            max_order_size=600,
            backstory=(
                "University endowment manager. 60/40 by gravity; rebalances "
                "quarterly, ignores anything that isn't a regime change."
            ),
        ),
        TraderPersona(
            agent_id="pension-05",
            display_name="Ivan Kovačević",
            archetype=TraderArchetype.PENSION_FUND,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=160.0,
            max_order_size=450,
            backstory=(
                "Sovereign-wealth co-investor. Multi-decade horizon, contrarian "
                "on macro shocks; happy to be early by two years."
            ),
        ),
        TraderPersona(
            agent_id="pension-06",
            display_name="Henrik Lindqvist",
            archetype=TraderArchetype.PENSION_FUND,
            risk_tolerance=RiskTolerance.MODERATE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=140.0,
            max_order_size=520,
            backstory=(
                "Nordic public-pension allocator. Tilted to quality and low "
                "vol; trims into euphoria, adds on multi-year drawdowns."
            ),
        ),
        TraderPersona(
            agent_id="pension-07",
            display_name="Cordelia Bright",
            archetype=TraderArchetype.PENSION_FUND,
            risk_tolerance=RiskTolerance.CONSERVATIVE,
            time_horizon=TimeHorizon.LONG_TERM,
            tick_period_s=220.0,
            max_order_size=400,
            backstory=(
                "Liability-driven actuary. Matches duration to obligations; "
                "won't trade unless the funded ratio asks her to."
            ),
        ),
    ]


__all__ = ["default_roster"]
