"use client";

import { useEffect, useState } from "react";

import type { NewsHeadline } from "@/app/lib/news/types";

interface BackendNewsFeedProps {
  headlines: NewsHeadline[];
  /** Current fair price; used to compute the move since each headline. */
  currentFair: number | null;
  /** Lookup of fair-at-tick from `useExchange.priceAt`. */
  priceAt: (tick_id: number) => number | null;
  /** Empty-state hint (e.g. "Connecting…"). */
  emptyHint?: string;
}

export function BackendNewsFeed({
  headlines,
  currentFair,
  priceAt,
  emptyHint = "No headlines yet. Inject one above to see the population react.",
}: BackendNewsFeedProps) {
  // 1 Hz clock so relative timestamps stay fresh without re-rendering on every
  // SSE event from upstream.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Snapshot the publish-time fair for each headline the first time we can
  // resolve it. The fair-price ring in `useExchange` only retains ~2min of
  // history (historyCap = 600 @ 5Hz), so without this cache the pct anchor
  // would silently fall off the edge of the buffer once a headline aged out
  // and the indicator would degrade to "—". Keyed by headline_id; bounded by
  // the parent's headline cap via the prune step below.
  const [anchors, setAnchors] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  // Re-run on every snapshot (currentFair changes at the SSE rate) so we can
  // retry resolution if `priceAt` was empty when the headline first landed.
  // Returns the same reference when nothing changed so React bails the update.
  useEffect(() => {
    setAnchors((prev) => {
      let next: Map<string, number> | null = null;
      const live = new Set<string>();
      for (const h of headlines) {
        live.add(h.headline_id);
        if (!prev.has(h.headline_id)) {
          const resolved = priceAt(h.tick_id);
          if (resolved !== null) {
            next ??= new Map(prev);
            next.set(h.headline_id, resolved);
          }
        }
      }
      // Drop anchors whose headline has rolled out of the parent's buffer.
      for (const id of prev.keys()) {
        if (!live.has(id)) {
          next ??= new Map(prev);
          next.delete(id);
        }
      }
      return next ?? prev;
    });
  }, [headlines, priceAt, currentFair]);

  if (!headlines.length) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-6 text-center text-xs text-[var(--color-fg-faint)]">
        {emptyHint}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-line)]">
      {headlines.map((h, idx) => {
        // Read the publish-time fair from the anchor cache. May be undefined
        // for one render after a headline first arrives (we resolve in the
        // effect above), in which case pct degrades to "—" until the cache
        // lands — same UX as before, just no longer terminal once the price
        // ring rolls past `h.tick_id`.
        const anchor = anchors.get(h.headline_id) ?? null;
        const pct =
          anchor !== null && anchor !== 0 && currentFair !== null
            ? ((currentFair - anchor) / anchor) * 100
            : null;
        const pctTone =
          pct === null || Math.abs(pct) < 0.05
            ? "var(--color-fg-faint)"
            : pct > 0
              ? "var(--color-up)"
              : "var(--color-down)";
        const isLatest = idx === 0;
        const ageSeconds = Math.max(0, Math.floor((now - h.ts * 1000) / 1000));

        return (
          <li
            key={h.headline_id}
            className={`relative px-4 py-3.5 ${
              isLatest
                ? "bg-[color-mix(in_oklab,var(--color-accent)_4%,transparent)]"
                : ""
            }`}
          >
            {isLatest && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[2px] bg-[var(--color-accent)]"
              />
            )}
            <p className="text-[15px] font-semibold leading-snug tracking-tight text-[var(--color-fg)]">
              {h.headline}
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
              <span className="text-[var(--color-fg-faint)]">
                {formatRelative(ageSeconds)}
              </span>
              <span className="tabular-nums" style={{ color: pctTone }}>
                {pct === null
                  ? "—"
                  : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatRelative(seconds: number): string {
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
