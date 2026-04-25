"use client";

import { useMemo } from "react";

import { ARCHETYPE_LIST, ARCHETYPES } from "@/app/lib/sim/archetypes";
import type { Agent, AgentArchetype, AgentDecision } from "@/app/lib/sim/types";

interface CohortLegendProps {
  agents: Agent[];
  decisions: AgentDecision[];
  referenceTs: number;
}

export function CohortLegend({
  agents,
  decisions,
  referenceTs,
}: CohortLegendProps) {
  const stats = useMemo(() => {
    const map = new Map<
      AgentArchetype,
      { count: number; buys: number; sells: number; pos: number }
    >();
    for (const a of agents) {
      const cur = map.get(a.archetype) ?? {
        count: 0,
        buys: 0,
        sells: 0,
        pos: 0,
      };
      cur.count += 1;
      cur.pos += a.position;
      map.set(a.archetype, cur);
    }
    const cutoff = referenceTs - 8000;
    for (const d of decisions) {
      if (d.ts < cutoff) continue;
      const cur = map.get(d.archetype);
      if (!cur) continue;
      if (d.side === "buy") cur.buys += 1;
      if (d.side === "sell") cur.sells += 1;
    }
    return map;
  }, [agents, decisions, referenceTs]);

  return (
    <ul className="divide-y divide-[var(--color-line)]">
      {ARCHETYPE_LIST.map((meta) => {
        const s = stats.get(meta.id) ?? {
          count: 0,
          buys: 0,
          sells: 0,
          pos: 0,
        };
        const total = Math.max(1, s.buys + s.sells);
        const buyShare = s.buys / total;
        return (
          <li key={meta.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-faint)]">
                  {meta.cohort === "mechanical" ? "MECH" : "DISC"}
                </span>
                <span className="text-sm text-[var(--color-fg)]">
                  {meta.label}
                </span>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
                {s.count}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative h-1 flex-1 overflow-hidden bg-[var(--color-surface-3)]">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--color-up)]"
                  style={{ width: `${buyShare * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-[var(--color-down)]"
                  style={{ width: `${(1 - buyShare) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-faint)]">
                cd {ARCHETYPES[meta.id].cooldownMs}ms
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]">
              <span style={{ color: "var(--color-up)" }}>{s.buys} buy</span>
              <span style={{ color: "var(--color-down)" }}>{s.sells} sell</span>
              <span className="ml-auto">net {s.pos.toLocaleString()}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
