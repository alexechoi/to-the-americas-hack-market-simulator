"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

interface AgentLatticeProps {
  /** number of dots in the lattice. */
  count?: number;
  className?: string;
}

interface Dot {
  id: number;
  x: number;
  y: number;
  delay: number;
}

/**
 * The hero "swarm". A dense lattice of agent nodes that breathe in unison and
 * occasionally fire off a buy/sell flash. Pure SVG, no external libs beyond
 * motion/react. Sized to fill its container.
 */
export function AgentLattice({ count = 220, className }: AgentLatticeProps) {
  const dots = useMemo<Dot[]>(() => layoutLattice(count), [count]);

  // 3 random firing dots per cycle; rotated so the surface always feels live
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1100);
    return () => window.clearInterval(id);
  }, []);

  const firing = useMemo(() => pickFiring(dots, tick), [dots, tick]);

  return (
    <svg
      viewBox="0 0 600 360"
      className={`h-full w-full ${className ?? ""}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {/* faint scaffolding lines */}
      <g stroke="var(--color-line)" strokeWidth="0.5">
        <line x1="0" y1="180" x2="600" y2="180" strokeDasharray="2 5" />
        <line x1="300" y1="0" x2="300" y2="360" strokeDasharray="2 5" />
      </g>

      {/* base lattice */}
      {dots.map((d) => (
        <motion.circle
          key={d.id}
          cx={d.x}
          cy={d.y}
          r={1.4}
          fill="var(--color-fg-muted)"
          initial={{ opacity: 0.18 }}
          animate={{ opacity: [0.18, 0.42, 0.18] }}
          transition={{
            duration: 3.4,
            delay: d.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* firing dots — buy/sell flashes with an orbit ring */}
      {firing.map((f, i) => (
        <g key={`${tick}-${i}`}>
          <motion.circle
            cx={f.dot.x}
            cy={f.dot.y}
            r={2}
            fill={f.side === "buy" ? "var(--color-up)" : "var(--color-down)"}
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0, 1, 0.4] }}
            transition={{ duration: 1.0 }}
          />
          <motion.circle
            cx={f.dot.x}
            cy={f.dot.y}
            r={3}
            fill="none"
            stroke={f.side === "buy" ? "var(--color-up)" : "var(--color-down)"}
            strokeWidth="0.8"
            initial={{ r: 3, opacity: 0.7 }}
            animate={{ r: 14, opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
          />
        </g>
      ))}
    </svg>
  );
}

function layoutLattice(count: number): Dot[] {
  const cols = Math.ceil(Math.sqrt(count * (600 / 360)));
  const rows = Math.ceil(count / cols);
  const cellW = 600 / cols;
  const cellH = 360 / rows;
  const out: Dot[] = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (id >= count) break;
      const offset = r % 2 === 0 ? 0 : cellW / 2;
      out.push({
        id,
        x: c * cellW + cellW / 2 + offset,
        y: r * cellH + cellH / 2,
        delay: ((c + r) % 8) * 0.18,
      });
      id += 1;
    }
  }
  return out;
}

function pickFiring(dots: Dot[], tick: number) {
  if (!dots.length) return [];
  const seedFrom = (n: number) => {
    let x = (n * 9301 + 49297) % 233280;
    return () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280;
    };
  };
  const rand = seedFrom(tick + 1);
  return Array.from({ length: 6 }).map(() => ({
    dot: dots[Math.floor(rand() * dots.length)],
    side: (rand() > 0.5 ? "buy" : "sell") as "buy" | "sell",
  }));
}
