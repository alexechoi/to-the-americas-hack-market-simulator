"use client";

import { useEffect, useState } from "react";

import type { NewsHeadline } from "@/app/lib/sim/types";

import { Tag } from "../ui/Tag";

interface NewsFeedProps {
  news: NewsHeadline[];
}

export function NewsFeed({ news }: NewsFeedProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!news.length) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-center text-xs text-[var(--color-fg-faint)]">
        No headlines on tape. Inject one to see the population react.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-line)]">
      {news.map((n) => {
        const seconds = Math.max(0, Math.floor((now - n.ts) / 1000));
        const ago = formatRelative(seconds);
        const tone =
          n.sentiment > 0.1 ? "up" : n.sentiment < -0.1 ? "down" : "muted";
        return (
          <li key={n.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
                  {n.source}
                </span>
                {n.injected && <Tag tone="accent">Injected</Tag>}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-faint)]">
                {ago}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-snug text-[var(--color-fg)]">
              {n.title}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Tag tone={tone}>
                {n.sentiment > 0 ? "+" : ""}
                {n.sentiment.toFixed(2)} sentiment
              </Tag>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-faint)]">
                Shocked agents
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatRelative(seconds: number) {
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
