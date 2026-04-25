"use client";

import { motion } from "motion/react";

const STATEMENTS = [
  {
    n: "01",
    title: "Every market is a population.",
    body: "A price is the rolling vote of every actor in front of a screen. We give you the actors — by archetype, by reflex, by conviction — and watch them vote in real time.",
  },
  {
    n: "02",
    title: "Headlines are inputs.",
    body: "Inject the news that hasn't happened yet. Read the dispersion across cohorts before the tape does.",
  },
  {
    n: "03",
    title: "Reflexes are the alpha.",
    body: "HFT moves in milliseconds. Retail moves in minutes. The gap between them is opportunity. We model the gap.",
  },
];

export function Manifesto() {
  return (
    <section
      id="how"
      className="relative border-y border-[var(--color-line)] bg-[var(--color-bg)]"
    >
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.18]" />
      <div className="relative mx-auto max-w-[1440px] px-6 py-28 md:px-10">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-fg-muted)]"
        >
          ◉ Manifesto · v0.1
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-6 max-w-5xl text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--color-fg)] md:text-6xl"
        >
          Markets are not equations.
          <span className="text-[var(--color-fg-faint)]">
            {" "}
            They are{" "}
            <em className="not-italic text-[var(--color-fg)]">crowds</em> with
            different reflexes, different memories, and different incentives.
          </span>
        </motion.h2>

        <div className="mt-16 grid grid-cols-1 gap-px border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-3">
          {STATEMENTS.map((s, i) => (
            <motion.article
              key={s.n}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className="flex flex-col gap-4 bg-[var(--color-surface)] p-7"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                / {s.n}
              </span>
              <h3 className="text-xl font-semibold leading-tight tracking-tight text-[var(--color-fg)]">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {s.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
