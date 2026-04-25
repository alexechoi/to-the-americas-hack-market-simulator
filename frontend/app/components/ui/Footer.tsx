import Link from "next/link";

import { Logo } from "./Logo";

const SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Simulator", href: "/sim" }
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Built at Unicorn Mafia, London", href: "https://unicornmafia.ai" },
      { label: "GitHub", href: "https://github.com/alexechoi/to-the-americas-hack-market-simulator" },
      { label: "Contact", href: "https://clawforall.app" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1440px] px-6 py-14">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Logo size={18} />
              <span className="text-sm font-semibold tracking-tight">
                Animal Spirits
              </span>
            </div>
            <p className="max-w-sm text-sm text-[var(--color-fg-muted)]">
              A finance-native multi-agent market simulator. Built by traders
              who got tired of social-feed simulations pretending to model
              markets.
            </p>
          </div>
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
                {section.title}
              </span>
              <ul className="flex flex-col gap-2.5">
                {section.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-fg-faint)] md:flex-row md:items-center md:justify-between">
          <span className="font-mono uppercase tracking-[0.18em]">
            © 2026 Animal Spirits Labs. Not investment advice.
          </span>
          <span className="font-mono uppercase tracking-[0.18em]">
            London · San Francisco
          </span>
        </div>
      </div>
    </footer>
  );
}
