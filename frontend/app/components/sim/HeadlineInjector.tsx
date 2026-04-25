"use client";

import { useState } from "react";

import { Button } from "../ui/Button";

interface HeadlineInjectorProps {
  onInject: (title: string, sentiment: number) => void;
}

const PRESETS: { title: string; sentiment: number; label: string }[] = [
  {
    label: "Export curbs",
    title: "US tightens AI chip export rules to additional fabs",
    sentiment: -0.55,
  },
  {
    label: "Earnings beat",
    title: "Q3 revenue beats consensus by 8%, guide raised",
    sentiment: 0.55,
  },
  {
    label: "Hyperscaler deal",
    title: "Multi-year $10B supply agreement with hyperscaler",
    sentiment: 0.65,
  },
  {
    label: "Hawkish Fed",
    title: "FOMC delivers hawkish surprise; 25bp dot-plot lift",
    sentiment: -0.4,
  },
];

export function HeadlineInjector({ onInject }: HeadlineInjectorProps) {
  const [title, setTitle] = useState("");
  const [sentiment, setSentiment] = useState(0);

  const submit = () => {
    if (!title.trim()) return;
    onInject(title.trim(), sentiment);
    setTitle("");
    setSentiment(0);
  };

  const tone =
    sentiment > 0.1
      ? "var(--color-up)"
      : sentiment < -0.1
        ? "var(--color-down)"
        : "var(--color-fg-muted)";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setTitle(p.title);
              setSentiment(p.sentiment);
            }}
            className="border border-[var(--color-line-strong)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-fg-faint)] hover:text-[var(--color-fg)]"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="border border-[var(--color-line-strong)] bg-[var(--color-surface-2)]">
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Type a headline · ⌘↵ to inject"
          rows={2}
          className="block w-full resize-none bg-transparent px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-line)] px-3 py-2">
          <div className="flex flex-1 items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
              Sentiment
            </span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={sentiment}
              onChange={(e) => setSentiment(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--color-accent)]"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span
              className="w-12 text-right font-mono text-xs tabular-nums"
              style={{ color: tone }}
            >
              {sentiment > 0 ? "+" : ""}
              {sentiment.toFixed(2)}
            </span>
          </div>
          <Button size="sm" onClick={submit} disabled={!title.trim()}>
            Inject
            <span aria-hidden>↵</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
