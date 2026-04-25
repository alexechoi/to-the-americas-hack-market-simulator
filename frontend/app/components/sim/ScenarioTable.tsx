"use client";

import type { ScenarioRow } from "@/app/lib/sim/types";

interface ScenarioTableProps {
  rows: ScenarioRow[];
  /** Compact list view for narrow side rails. */
  compact?: boolean;
}

export function ScenarioTable({ rows, compact }: ScenarioTableProps) {
  if (compact) {
    return (
      <ul className="divide-y divide-[var(--color-line)]">
        {rows.map((r) => {
          const tone =
            r.expectedMove > 0
              ? "var(--color-up)"
              : r.expectedMove < 0
                ? "var(--color-down)"
                : "var(--color-fg-muted)";
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
            >
              <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-[var(--color-fg-muted)]">
                {(r.probability * 100).toFixed(0)}%
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-fg)]">
                {r.headline}
              </span>
              <span
                className="shrink-0 font-mono text-xs tabular-nums"
                style={{ color: tone }}
              >
                {r.expectedMove > 0 ? "+" : ""}
                {r.expectedMove.toFixed(2)}%
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
          <th className="border-b border-[var(--color-line)] px-4 py-2.5 text-left font-normal">
            Scenario
          </th>
          <th className="border-b border-[var(--color-line)] px-4 py-2.5 text-right font-normal">
            P
          </th>
          <th className="border-b border-[var(--color-line)] px-4 py-2.5 text-right font-normal">
            Expected
          </th>
          <th className="border-b border-[var(--color-line)] px-4 py-2.5 text-right font-normal">
            Dispersion
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const tone =
            r.expectedMove > 0
              ? "var(--color-up)"
              : r.expectedMove < 0
                ? "var(--color-down)"
                : "var(--color-fg-muted)";
          return (
            <tr
              key={r.id}
              className="text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              <td className="border-b border-[var(--color-line)] px-4 py-3 align-top">
                <div className="text-sm leading-snug">{r.headline}</div>
              </td>
              <td className="border-b border-[var(--color-line)] px-4 py-3 text-right align-top">
                <div className="font-mono text-sm tabular-nums">
                  {(r.probability * 100).toFixed(0)}%
                </div>
                <div className="mt-1 h-1 w-20 bg-[var(--color-surface-3)]">
                  <div
                    className="h-full bg-[var(--color-fg-muted)]"
                    style={{ width: `${r.probability * 100}%` }}
                  />
                </div>
              </td>
              <td
                className="border-b border-[var(--color-line)] px-4 py-3 text-right align-top font-mono text-sm tabular-nums"
                style={{ color: tone }}
              >
                {r.expectedMove > 0 ? "+" : ""}
                {r.expectedMove.toFixed(2)}%
              </td>
              <td className="border-b border-[var(--color-line)] px-4 py-3 text-right align-top">
                <div className="ml-auto h-1 w-20 bg-[var(--color-surface-3)]">
                  <div
                    className="h-full bg-[var(--color-fg-faint)]"
                    style={{ width: `${r.variance * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
