import type { ReactNode } from "react";

type TagTone = "neutral" | "up" | "down" | "accent" | "muted";

interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  className?: string;
}

const tones: Record<TagTone, string> = {
  neutral:
    "border-[var(--color-line-strong)] text-[var(--color-fg-muted)] bg-transparent",
  up: "border-transparent bg-[color-mix(in_oklab,var(--color-up)_20%,transparent)] text-[var(--color-up)]",
  down: "border-transparent bg-[color-mix(in_oklab,var(--color-down)_20%,transparent)] text-[var(--color-down)]",
  accent:
    "border-transparent bg-[color-mix(in_oklab,var(--color-accent)_18%,transparent)] text-[var(--color-accent)]",
  muted:
    "border-transparent bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]",
};

export function Tag({ children, tone = "neutral", className }: TagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${tones[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
