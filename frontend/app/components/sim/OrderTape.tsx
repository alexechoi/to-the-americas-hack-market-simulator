"use client";

import type { AgentDecision } from "@/app/lib/sim/types";

interface OrderTapeProps {
  decisions: AgentDecision[];
  limit?: number;
}

export function OrderTape({ decisions, limit = 14 }: OrderTapeProps) {
  const orders = decisions.filter((d) => d.side !== "hold").slice(0, limit);
  return (
    <div className="grid grid-cols-[60px_1fr_70px_70px] gap-x-3 px-4 py-3 font-mono text-[11px] tabular-nums text-[var(--color-fg)]">
      <div className="contents font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        <span>Side</span>
        <span>Agent</span>
        <span className="text-right">Size</span>
        <span className="text-right">Price</span>
      </div>
      {orders.length === 0 ? (
        <div className="col-span-4 mt-3 text-center text-xs text-[var(--color-fg-faint)]">
          No fills yet.
        </div>
      ) : (
        orders.map((d) => {
          const tone =
            d.side === "buy" ? "var(--color-up)" : "var(--color-down)";
          return (
            <div
              key={d.id}
              className="contents"
              style={{ color: "var(--color-fg)" }}
            >
              <span style={{ color: tone }}>{d.side.toUpperCase()}</span>
              <span className="truncate text-[var(--color-fg-muted)]">
                {d.agentName}
              </span>
              <span className="text-right">{d.size.toLocaleString()}</span>
              <span className="text-right">{d.price.toFixed(2)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
