interface LiveDotProps {
  label?: string;
  tone?: "live" | "paused";
  className?: string;
}

export function LiveDot({
  label = "Live",
  tone = "live",
  className,
}: LiveDotProps) {
  const color =
    tone === "live" ? "bg-[var(--color-up)]" : "bg-[var(--color-fg-faint)]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] ${
        className ?? ""
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${color} ${tone === "live" ? "animate-live" : ""}`}
      />
      {label}
    </span>
  );
}
