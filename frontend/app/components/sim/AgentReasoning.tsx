"use client";

import { ARCHETYPES } from "@/app/lib/sim/archetypes";
import type { AgentDecision } from "@/app/lib/sim/types";

interface AgentReasoningProps {
  decisions: AgentDecision[];
  limit?: number;
}

export function AgentReasoning({ decisions, limit = 30 }: AgentReasoningProps) {
  if (!decisions.length) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-center text-xs text-[var(--color-fg-faint)]">
        Agents are warming up…
      </div>
    );
  }
  return (
    <ol className="divide-y divide-[var(--color-line)]">
      {decisions.slice(0, limit).map((d) => {
        const tone =
          d.side === "buy"
            ? "var(--color-up)"
            : d.side === "sell"
              ? "var(--color-down)"
              : "var(--color-fg-muted)";
        const label = d.side.toUpperCase();
        const meta = ARCHETYPES[d.archetype];
        return (
          <li key={d.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-[10px] tabular-nums tracking-[0.16em]"
                  style={{ color: tone }}
                >
                  {label}
                </span>
                {d.side !== "hold" && (
                  <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg)]">
                    {d.size.toLocaleString()}
                  </span>
                )}
                <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-faint)]">
                  @ {d.price.toFixed(2)}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-faint)]">
                {meta.shortLabel}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-snug text-[var(--color-fg)]">
              <span className="text-[var(--color-fg-muted)]">
                {d.agentName}:
              </span>{" "}
              {d.reasoning}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
