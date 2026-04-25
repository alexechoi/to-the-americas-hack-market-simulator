"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { WarpBackground } from "../ui/WarpBackground";

export function CallToAction() {
  return (
    <section className="relative isolate overflow-hidden border-y border-[var(--color-line)]">
      <WarpBackground intensity={0.7} speed={2} grid={false} />

      <div className="relative z-10 mx-auto max-w-[1440px] px-6 py-32 md:px-10">

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-6 max-w-5xl text-5xl font-semibold leading-[0.95] tracking-tight text-[var(--color-fg)] md:text-7xl"
        >
          See the market move
          <br />
          <span className="text-[var(--color-accent)]">before</span> the market
          moves.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center"
        >
          <Link
            href="/sim"
            className="group inline-flex h-12 items-center gap-2 bg-[var(--color-accent)] px-6 text-sm font-medium tracking-tight text-[var(--color-accent-ink)] transition-colors hover:bg-[#e6ff5e]"
          >
            Step onto the floor
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
          <Link
            href="/sim"
            className="inline-flex h-12 items-center gap-2 border border-[var(--color-line-strong)] bg-transparent px-6 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-fg-faint)] hover:bg-[color-mix(in_oklab,var(--color-surface-2)_70%,transparent)]"
          >
            Inject a headline
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
