"use client";

import { motion } from "motion/react";

const PERSONAS = [
  {
    id: "hft",
    label: "HFT",
    cohort: "Algo · sub-second",
    reflex: "ms",
    horizon: "5–500ms",
    note: "Latency-arbitrage. Reads order-book pressure faster than the page can repaint.",
  },
  {
    id: "gamma",
    label: "Gamma desk",
    cohort: "Algo · sub-second",
    reflex: "ms",
    horizon: "intraday",
    note: "Hedges options exposure. Forces flow into the close as gamma flips sign.",
  },
  {
    id: "cta",
    label: "CTA",
    cohort: "Mechanical · seconds",
    reflex: "s",
    horizon: "days",
    note: "Trend follower. Has no opinion. Will keep buying until it doesn't.",
  },
  {
    id: "macro",
    label: "Macro PM",
    cohort: "Discretionary",
    reflex: "min",
    horizon: "weeks",
    note: "Reads central banks like tea leaves. Levers up on conviction. Sits in cash on doubt.",
  },
  {
    id: "long_only",
    label: "Long-only",
    cohort: "Discretionary",
    reflex: "min",
    horizon: "quarters",
    note: "Benchmarked. Slow to add, slower to cut. Quietly the largest pool of capital.",
  },
  {
    id: "contrarian",
    label: "Contrarian",
    cohort: "Discretionary",
    reflex: "min",
    horizon: "weeks",
    note: "Fades the consensus. Blows up gloriously twice a decade. Right the rest of the time.",
  },
  {
    id: "treasury",
    label: "Corp treasury",
    cohort: "Mechanical",
    reflex: "s",
    horizon: "buyback window",
    note: "VWAP-style execution. Predictable, mechanical bid. The market's metronome.",
  },
  {
    id: "retail",
    label: "Retail",
    cohort: "Slow · loud",
    reflex: "min–day",
    horizon: "vibes",
    note: "Reads the timeline. Trades at the close. Provides the liquidity everyone else takes.",
  },
];

export function Personas() {
  return (
    <section id="personas" className="relative bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1440px] px-6 py-28 md:px-10">
        <div className="flex items-end justify-between gap-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-fg-muted)]">
              ◉ The population · 8 archetypes · 124 agents
            </p>
            <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] md:text-5xl">
              You are not trading the market.
              <span className="text-[var(--color-fg-faint)]">
                {" "}
                You are trading these eight people.
              </span>
            </h2>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)] md:inline">
            sorted by reflex →
          </span>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-px border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p, i) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group flex flex-col gap-3 bg-[var(--color-surface)] p-5 transition-colors hover:bg-[var(--color-surface-2)]"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-[var(--color-fg)]">
                  {p.label}
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
                  {p.reflex}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                {p.cohort}
              </span>
              <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {p.note}
              </p>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--color-line)] pt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
                <span>Horizon</span>
                <span className="text-[var(--color-fg-muted)]">
                  {p.horizon}
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
