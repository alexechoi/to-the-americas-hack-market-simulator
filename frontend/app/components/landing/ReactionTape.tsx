"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

const SHOCKS: { headline: string; sentiment: number; source: string }[] = [
  {
    headline: "FED HOLDS · DOT PLOT REVISED HIGHER",
    sentiment: -0.6,
    source: "Bloomberg",
  },
  {
    headline: "NVDA GUIDES Q4 ABOVE STREET · DC EXPORT WAIVERS GRANTED",
    sentiment: 0.85,
    source: "Reuters",
  },
  {
    headline: "GEOPOLITICAL: STRAIT TRANSIT HALTED FOR 6 HOURS",
    sentiment: -0.7,
    source: "FT",
  },
  {
    headline: "CPI CORE 0.2% MoM · BELOW CONSENSUS",
    sentiment: 0.55,
    source: "BLS",
  },
  {
    headline: "MAJOR HEDGE FUND GATES REDEMPTIONS",
    sentiment: -0.8,
    source: "WSJ",
  },
];

const SAMPLES = 90;
const WIDTH = 600;
const HEIGHT = 220;

export function ReactionTape() {
  const [shockIdx, setShockIdx] = useState(0);
  const [series, setSeries] = useState<number[]>(() =>
    seedSeries(SAMPLES, 100),
  );
  const tickRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickRef.current += 1;
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const drift = (Math.random() - 0.5) * 0.6;
        const shock = SHOCKS[shockIdx];
        // every 22 ticks, fire the current shock as a brief impulse
        const shockKick =
          tickRef.current % 22 === 0 ? shock.sentiment * 4.4 : 0;
        const next = clamp(last + drift + shockKick, 88, 112);
        return [...prev.slice(1), next];
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [shockIdx]);

  // rotate the headline so the tape feels live
  useEffect(() => {
    const id = window.setInterval(() => {
      setShockIdx((i) => (i + 1) % SHOCKS.length);
    }, 4800);
    return () => window.clearInterval(id);
  }, []);

  const path = useMemo(() => buildPath(series, WIDTH, HEIGHT), [series]);
  const last = series[series.length - 1];
  const open = series[0];
  const change = ((last - open) / open) * 100;
  const tone = change >= 0 ? "var(--color-up)" : "var(--color-down)";
  const shock = SHOCKS[shockIdx];

  return (
    <div className="relative h-full w-full overflow-hidden border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
            NVDA · 1m · simulated
          </span>
          <span
            className="font-mono text-xs tabular-nums"
            style={{ color: tone }}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </div>
        <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)] sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-up)] animate-live" />
          Engine online · 124 agents
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-[220px] w-full"
      >
        {/* horizontal grid */}
        {[0.2, 0.4, 0.6, 0.8].map((p) => (
          <line
            key={p}
            x1="0"
            x2={WIDTH}
            y1={HEIGHT * p}
            y2={HEIGHT * p}
            stroke="var(--color-line)"
            strokeDasharray="2 5"
            strokeWidth="1"
          />
        ))}
        {/* injected headline marker */}
        <line
          x1={WIDTH * 0.78}
          x2={WIDTH * 0.78}
          y1="0"
          y2={HEIGHT}
          stroke="var(--color-accent)"
          strokeWidth="1.2"
        />
        <circle cx={WIDTH * 0.78} cy="10" r="3" fill="var(--color-accent)" />
        {/* the price path itself */}
        <motion.path
          d={path}
          fill="none"
          stroke={tone}
          strokeWidth="1.4"
          initial={false}
          animate={{ d: path }}
          transition={{ duration: 0.18, ease: "linear" }}
        />
      </svg>

      {/* injected headline strip */}
      <div className="border-t border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
          ↳ injected headline · {shock.source}
        </p>
        <motion.p
          key={shockIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-1 truncate text-sm font-medium tracking-tight text-[var(--color-fg)]"
        >
          {shock.headline}
        </motion.p>
      </div>
    </div>
  );
}

function seedSeries(n: number, base: number): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * 0.4;
    out.push(v);
  }
  return out;
}

function buildPath(series: number[], width: number, height: number): string {
  if (series.length < 2) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const pad = (max - min) * 0.18 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const stepX = width / (series.length - 1);
  return series
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - yMin) / (yMax - yMin)) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
