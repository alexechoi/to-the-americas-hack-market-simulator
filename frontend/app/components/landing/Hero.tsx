"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { spawnExchange } from "@/app/lib/exchange/api";

import { WarpBackground } from "../ui/WarpBackground";
import { AgentLattice } from "./AgentLattice";
import { ReactionTape } from "./ReactionTape";

export function Hero() {
  const router = useRouter();
  const [ticker, setTicker] = useState("NVDA");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!symbol || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Bootstrap the backend BEFORE routing — `/sim` mounts the SSE stream
      // immediately on render and we want it to receive the new ticker on its
      // very first envelope rather than re-spawning mid-render.
      await spawnExchange(symbol);
      router.push(`/sim/${symbol}`);
    } catch (err) {
      console.error("spawnExchange failed", err);
      setError(err instanceof Error ? err.message : "Failed to spawn ticker");
      setSubmitting(false);
    }
  };

  return (
    <section className="relative isolate overflow-hidden">
      <WarpBackground intensity={0.62} speed={1.6} />

      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-[1440px] flex-col px-6 pb-24 md:px-10">
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
              population of trader personas - HFT, macro, retail, gamma, CTA -
              breathing in real time, reacting to every headline you can
              imagine, before it ships.
            </motion.p>

            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              onSubmit={handleEnter}
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <label className="flex items-stretch border border-[var(--color-line-strong)] bg-[var(--color-surface)] focus-within:border-[var(--color-accent)]">
                <span className="flex items-center px-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
                  ticker
                </span>
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  spellCheck={false}
                  autoCapitalize="characters"
                  maxLength={16}
                  disabled={submitting}
                  placeholder="NVDA"
                  className="h-12 w-16 bg-transparent pr-4 font-mono text-sm tracking-[0.08em] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-faint)] disabled:opacity-60"
                />
              </label>
              <button
                type="submit"
                disabled={submitting || !ticker.trim()}
                className="group inline-flex h-12 items-center gap-2 bg-[var(--color-accent)] px-6 text-sm font-medium tracking-tight text-[var(--color-accent-ink)] transition-colors hover:bg-[#e6ff5e] disabled:opacity-60 disabled:hover:bg-[var(--color-accent)]"
              >
                {submitting ? "Bootstrapping…" : "Launch"}
                {!submitting && (
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                )}
              </button>
              <Link
                href="/#how"
                className="inline-flex h-12 items-center gap-2 border border-[var(--color-line-strong)] bg-transparent px-6 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-fg-faint)] hover:bg-[var(--color-surface-2)]"
              >
                Read the manifesto
              </Link>
            </motion.form>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-down)]"
              >
                {error}
              </motion.p>
            )}
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
      </div>
    </section>
  );
}
