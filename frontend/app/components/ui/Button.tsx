import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "accent" | "ghost" | "outline" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const variants: Record<Variant, string> = {
  accent:
    "bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:bg-[#e6ff5e] active:bg-[#c8ef2a] disabled:bg-[var(--color-surface-3)] disabled:text-[var(--color-fg-faint)]",
  ghost:
    "bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:text-[var(--color-fg-faint)]",
  outline:
    "border border-[var(--color-line-strong)] bg-transparent text-[var(--color-fg)] hover:border-[var(--color-fg-faint)] hover:bg-[var(--color-surface-2)]",
  danger:
    "bg-[var(--color-down)] text-[var(--color-bg)] hover:bg-[#ff8585] active:bg-[#e75555]",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-sm",
};

export function Button({
  variant = "accent",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-colors disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
