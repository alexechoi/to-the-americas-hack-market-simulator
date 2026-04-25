"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { WarpBackground } from "../ui/WarpBackground";
import { AgentLattice } from "./AgentLattice";
import { ReactionTape } from "./ReactionTape";

const STAT_ROW = [
  { k: "Agents online", v: "124" },
  { k: "Cycles / sec", v: "3.6" },
  { k: "Avg reflex", v: "182ms" },
  { k: "Coverage", v: "11 markets" },
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <WarpBackground intensity={0.62} speed={0.4} />

      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-[1440px] flex-col px-6 pb-24 pt-16 md:px-10">
        {/* eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-fg-muted)]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-up)] animate-live" />
          Live · multi-agent market intelligence · v0.1
        </motion.div>

        {/* massive wordmark */}
        <div className="mt-10 grid grid-cols-1 items-end gap-10 lg:grid-cols-[1.55fr_1fr]">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              className="font-sans text-[15vw] leading-[0.86] tracking-[-0.04em] text-[var(--color-fg)] sm:text-[12vw] lg:text-[9.8vw]"
            >
              ANIMAL
              <br />
              <span className="relative inline-block">
                SPIRITS<span className="text-[var(--color-accent)]">.</span>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-8 max-w-2xl text-base leading-relaxed text-[var(--color-fg-muted)] md:text-lg"
            >
              We do not predict markets. We model the predators inside them. A
              population of trader personas — HFT, macro, retail, gamma, CTA —
              breathing in real time, reacting to every headline you can
              imagine, before it ships.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/sim"
                className="group inline-flex h-12 items-center gap-2 bg-[var(--color-accent)] px-6 text-sm font-medium tracking-tight text-[var(--color-accent-ink)] transition-colors hover:bg-[#e6ff5e]"
              >
                Open the floor
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
              <Link
                href="/#how"
                className="inline-flex h-12 items-center gap-2 border border-[var(--color-line-strong)] bg-transparent px-6 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-fg-faint)] hover:bg-[var(--color-surface-2)]"
              >
                Read the manifesto
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)] sm:ml-2">
                Live · v0.1 · London
              </span>
            </motion.div>
          </div>

          {/* lattice + tape */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="grid gap-3"
          >
            <div className="relative h-[260px] overflow-hidden border border-[var(--color-line)] bg-[var(--color-surface)]">
              <div className="absolute left-3 top-3 z-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                124 agents · honeycomb view
              </div>
              <AgentLattice />
            </div>
            <ReactionTape />
          </motion.div>
        </div>

        {/* stat strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 grid grid-cols-2 gap-px border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4"
        >
          {STAT_ROW.map((s) => (
            <div
              key={s.k}
              className="flex flex-col gap-1 bg-[var(--color-surface)] px-5 py-4"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
                {s.k}
              </span>
              <span className="font-sans text-2xl font-semibold tracking-tight tabular-nums text-[var(--color-fg)]">
                {s.v}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
