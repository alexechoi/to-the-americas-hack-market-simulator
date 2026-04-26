"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { spawnExchange } from "@/app/lib/exchange/api";

export function NavTickerForm() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!symbol || submitting) return;
    setSubmitting(true);
    try {
      // Mirror the Hero flow: bootstrap the backend before routing so that
      // /sim/[ticker]'s SSE stream receives the new ticker on its first
      // envelope rather than re-spawning mid-render.
      await spawnExchange(symbol);
      router.push(`/sim/${symbol}`);
    } catch (err) {
      console.error("spawnExchange failed", err);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleEnter} className="flex items-stretch gap-2">
      <label className="hidden h-9 items-stretch border border-[var(--color-line-strong)] bg-[var(--color-surface)] focus-within:border-[var(--color-accent)] md:flex">
        <span className="flex items-center px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
          ticker
        </span>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          spellCheck={false}
          autoCapitalize="characters"
          maxLength={16}
          disabled={submitting}
          placeholder="NVDA"
          aria-label="Ticker"
          className="h-full w-16 bg-transparent pr-3 font-mono text-sm tracking-[0.08em] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-faint)] disabled:opacity-60"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || !ticker.trim()}
        className="inline-flex h-9 items-center gap-1.5 bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent-ink)] transition-colors hover:bg-[#e6ff5e] disabled:opacity-60 disabled:hover:bg-[var(--color-accent)]"
      >
        {submitting ? "Bootstrapping…" : "Launch"}
        {!submitting && <span aria-hidden>↗</span>}
      </button>
    </form>
  );
}
