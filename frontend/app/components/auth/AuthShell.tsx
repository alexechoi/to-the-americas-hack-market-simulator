import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "../ui/Logo";
import { WarpBackground } from "../ui/WarpBackground";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Shared shell for /auth/* pages. Wave backdrop, brand mark top-left, brand
 * status mono line bottom-right, and a single panel that hosts the form.
 * No light-mode fallback — everything here is darkness.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  footer,
  children,
}: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <WarpBackground intensity={0.6} speed={0.45} />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
        >
          <Logo size={18} />
          <span className="text-sm font-semibold tracking-tight">
            Animal Spirits
          </span>
          <span className="ml-1 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)] sm:inline">
            v0.1
          </span>
        </Link>
        <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)] md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-up)] animate-live" />
          Engine online · 124 agents
        </span>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="border border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] backdrop-blur-md">
            <div className="border-b border-[var(--color-line)] px-6 pb-5 pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="px-6 py-6">{children}</div>
          </div>
          {footer && (
            <p className="mt-5 text-center text-sm text-[var(--color-fg-muted)]">
              {footer}
            </p>
          )}
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-between px-6 py-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)] md:px-10">
        <span>© 2026 Animal Spirits Labs</span>
        <span className="hidden md:inline">
          Not investment advice · session encrypted
        </span>
      </footer>
    </div>
  );
}
