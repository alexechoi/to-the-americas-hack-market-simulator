import Link from "next/link";

import { Logo } from "./Logo";
import { NavTickerForm } from "./NavTickerForm";

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
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-[var(--color-fg-muted)] md:flex">
            <Link
              href="/"
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
          </nav>
        </div>
        <NavTickerForm />
      </div>
    </header>
  );
}
