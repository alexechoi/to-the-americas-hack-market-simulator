import Link from "next/link";

import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_85%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
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
          <nav className="hidden items-center gap-6 text-sm text-[var(--color-fg-muted)] md:flex">
            <Link
              href="/sim"
              className="transition-colors hover:text-[var(--color-fg)]"
            >
              Simulator
            </Link>
            <Link
              href="/#how"
              className="transition-colors hover:text-[var(--color-fg)]"
            >
              How it works
            </Link>
            <Link
              href="/#research"
              className="transition-colors hover:text-[var(--color-fg)]"
            >
              Research
            </Link>
            <Link
              href="/#api"
              className="transition-colors hover:text-[var(--color-fg)]"
            >
              API
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sim"
            className="hidden h-9 items-center px-3 text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] md:inline-flex"
          >
            Open simulator
          </Link>
          <Link
            href="/sim"
            className="inline-flex h-9 items-center gap-1.5 bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent-ink)] transition-colors hover:bg-[#e6ff5e]"
          >
            Launch
            <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
