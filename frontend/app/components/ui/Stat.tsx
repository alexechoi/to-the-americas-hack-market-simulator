import type { ReactNode } from "react";

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  delta?: number;
  deltaSuffix?: string;
  mono?: boolean;
  align?: "left" | "right";
}

export function Stat({
  label,
  value,
  delta,
  deltaSuffix = "%",
  mono = true,
  align = "left",
}: StatProps) {
  const tone =
    delta === undefined
      ? "text-[var(--color-fg-muted)]"
      : delta > 0
        ? "text-[var(--color-up)]"
        : delta < 0
          ? "text-[var(--color-down)]"
          : "text-[var(--color-fg-muted)]";
  return (
    <div
      className={`flex flex-col gap-1 ${align === "right" ? "items-end text-right" : ""}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        {label}
      </span>
      <span
        className={`text-base text-[var(--color-fg)] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
      {delta !== undefined && (
        <span className={`font-mono text-xs tabular-nums ${tone}`}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(2)}
          {deltaSuffix}
        </span>
      )}
    </div>
  );
}
