"use client";

import { useEffect, useState } from "react";

interface MiniChartProps {
  height?: number;
}

/**
 * A self-contained, decorative mini chart for the landing hero. Generates a
 * small simulated walk so the homepage feels alive without requiring the full
 * engine. The chart drifts and occasionally jumps, like the real engine's
 * response to news.
 */
export function MiniChart({ height = 200 }: MiniChartProps) {
  const [points, setPoints] = useState<number[]>(() => seed(64, 142.18));

  useEffect(() => {
    const id = setInterval(() => {
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        const drift = (Math.random() - 0.5) * 0.6;
        const shock = Math.random() < 0.04 ? (Math.random() - 0.5) * 4 : 0;
        const next = Math.max(1, last + drift + shock);
        return [...prev.slice(-63), next];
      });
    }, 220);
    return () => clearInterval(id);
  }, []);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = (max - min) * 0.18 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const last = points[points.length - 1];
  const first = points[0];
  const tone = last >= first ? "var(--color-up)" : "var(--color-down)";
  const change = last - first;
  const changePct = (change / first) * 100;

  const W = 540;
  const H = height;

  const toX = (i: number) => (i / (points.length - 1)) * (W - 50);
  const toY = (v: number) => 8 + (1 - (v - yMin) / (yMax - yMin)) * (H - 32);

  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`)
    .join(" ");

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        {/* baseline grid */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={0}
            x2={W - 50}
            y1={8 + r * (H - 32)}
            y2={8 + r * (H - 32)}
            stroke="var(--color-line)"
            strokeDasharray="2 4"
          />
        ))}
        <path
          d={`${path} L ${toX(points.length - 1)} ${H - 8} L 0 ${H - 8} Z`}
          fill={`color-mix(in oklab, ${tone} 12%, transparent)`}
        />
        <path d={path} stroke={tone} strokeWidth={1.6} fill="none" />
        <circle cx={toX(points.length - 1)} cy={toY(last)} r={3} fill={tone} />
        <rect x={W - 48} y={toY(last) - 9} width={46} height={18} fill={tone} />
        <text
          x={W - 25}
          y={toY(last) + 4}
          fill="var(--color-bg)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          fontWeight={600}
          textAnchor="middle"
        >
          {last.toFixed(2)}
        </text>
      </svg>
      <div className="pointer-events-none absolute left-3 top-2 flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
          NVDA · simulated
        </span>
        <span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: tone }}
        >
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)} ({changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

function seed(n: number, start: number): number[] {
  const arr: number[] = [start];
  for (let i = 1; i < n; i++) {
    const last = arr[arr.length - 1];
    arr.push(last + (Math.random() - 0.5) * 0.7);
  }
  return arr;
}
