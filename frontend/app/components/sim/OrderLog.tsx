"use client";

import { archetypeMeta } from "@/app/lib/exchange/archetypes";
import type { OrderLogEntry } from "@/app/lib/exchange/types";

interface OrderLogProps {
  entries: OrderLogEntry[];
  limit?: number;
}

/**
 * Streaming feed of every decision the swarm makes plus every manual order
 * pushed through the FOK form. Entries are pre-sorted newest-first by
 * `useExchange`, so this component is purely presentational.
 *
 * Action colour: BUY → up, SELL → down, HOLD → muted. Manual entries render
 * with a `MANUAL` chip in place of an archetype label and skip the reasoning
 * paragraph since none is attached server-side.
 */
export function OrderLog({ entries, limit = 60 }: OrderLogProps) {
  if (!entries.length) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-center text-xs text-[var(--color-fg-faint)]">
        Awaiting first decision…
      </div>
    );
  }
  return (
    <ol className="divide-y divide-[var(--color-line)]">
      {entries.slice(0, limit).map((d) => {
        const tone =
          d.action === "buy"
            ? "var(--color-up)"
            : d.action === "sell"
              ? "var(--color-down)"
              : "var(--color-fg-muted)";
        const meta = archetypeMeta(d.archetype);
        const chipLabel = d.source === "manual" ? "MANUAL" : meta.shortLabel;
        const showQty = d.action !== "hold";
        return (
          <li key={d.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-[10px] tabular-nums tracking-[0.16em]"
                  style={{ color: tone }}
                >
                  {d.action.toUpperCase()}
                </span>
                {showQty && (
                  <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg)]">
                    {d.quantity.toLocaleString()}
                  </span>
                )}
                <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-faint)]">
                  @ {d.limitPrice.toFixed(2)}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-faint)]">
                {chipLabel}
              </span>
            </div>
            {d.reasoning && (
              <p className="mt-1.5 text-sm leading-snug text-[var(--color-fg)]">
                <span className="text-[var(--color-fg-muted)]">
                  {d.agentName ?? d.agentId}:
                </span>{" "}
                {d.reasoning}
              </p>
            )}
            {!d.reasoning && d.source === "manual" && (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
                {d.agentId}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
