"use client";

import { useState } from "react";

import { Button } from "@/app/components/ui/Button";
import { Panel } from "@/app/components/ui/Panel";
import { Tag } from "@/app/components/ui/Tag";
import { apiGet } from "@/app/lib/api";

type Status = "idle" | "running" | "ok" | "error";

const STATUS_TONE: Record<Status, "muted" | "accent" | "up" | "down"> = {
  idle: "muted",
  running: "accent",
  ok: "up",
  error: "down",
};

const STATUS_LABEL: Record<Status, string> = {
  idle: "Idle",
  running: "Running…",
  ok: "Pass",
  error: "Fail",
};

const HISTORY_PERIODS = ["5d", "1mo", "3mo", "6mo", "1y", "5y"] as const;

type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

interface YahooResponse {
  ticker?: string;
  found?: boolean;
  profile?: {
    longName?: string;
    shortName?: string;
    quoteType?: string;
    exchange?: string;
    sector?: string;
    industry?: string;
  };
  quote?: {
    currentPrice?: number;
    regularMarketPrice?: number;
    previousClose?: number;
    regularMarketChangePercent?: number;
    volume?: number;
  };
  valuation?: {
    marketCap?: number;
  };
  news?: unknown[];
  errors?: Record<string, string>;
  detail?: unknown;
}

function summarise(data: YahooResponse): Array<[string, string]> {
  const profile = data.profile ?? {};
  const quote = data.quote ?? {};
  const price = quote.currentPrice ?? quote.regularMarketPrice;
  const prev = quote.previousClose;
  const changePct =
    quote.regularMarketChangePercent ??
    (price != null && prev ? ((price - prev) / prev) * 100 : null);
  const marketCap = data.valuation?.marketCap;
  const newsCount = data.news?.length ?? 0;
  const errorCount = Object.keys(data.errors ?? {}).length;

  return [
    ["name", profile.longName || profile.shortName || "—"],
    ["type", profile.quoteType || "—"],
    ["exchange", profile.exchange || "—"],
    ["sector", profile.sector || profile.industry || "—"],
    ["price", price != null ? price.toLocaleString() : "—"],
    [
      "change",
      changePct != null
        ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`
        : "—",
    ],
    [
      "market cap",
      marketCap != null
        ? `${(marketCap / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 })}B`
        : "—",
    ],
    ["news", newsCount.toString()],
    ["sections failed", errorCount.toString()],
  ];
}

export function DebugYahooCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [result, setResult] = useState<YahooResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ticker, setTicker] = useState("AAPL");
  const [period, setPeriod] = useState<HistoryPeriod>("1mo");

  const handleRun = async () => {
    setStatus("running");
    setError(null);
    setResult(null);
    setLatencyMs(null);
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) {
      setStatus("error");
      setError("ticker is required");
      return;
    }
    const started = performance.now();
    try {
      const path = `/yahoo/ticker/${encodeURIComponent(symbol)}?news_count=5&history_period=${period}`;
      const data = await apiGet<YahooResponse>(path);
      setLatencyMs(performance.now() - started);
      setResult(data);
      setStatus(data?.found ? "ok" : "error");
      if (!data?.found) setError("ticker not found");
    } catch (err) {
      setLatencyMs(performance.now() - started);
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
      console.error("[debug] yahoo lookup failed", err);
    }
  };

  return (
    <Panel
      title="5 · Yahoo Finance scrape"
      caption="GET /yahoo/ticker/{ticker}"
      right={
        <div className="flex items-center gap-2">
          {latencyMs !== null && (
            <Tag tone="neutral">{latencyMs.toFixed(0)} ms</Tag>
          )}
          <Tag tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Tag>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          One-shot ticker lookup against the new yfinance-backed route. Returns
          profile, quote, valuation, financials, news, and a price history
          summary in a single response.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
              ticker
            </span>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              spellCheck={false}
              className="w-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-[12px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              placeholder="AAPL, BTC-USD, ^GSPC, EURUSD=X"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
              history
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as HistoryPeriod)}
              className="border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-[12px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            >
              {HISTORY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="accent"
            onClick={handleRun}
            disabled={status === "running"}
          >
            {status === "running" ? "Fetching…" : "Fetch ticker"}
          </Button>
        </div>

        {error && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-[var(--color-down)]/40 bg-[color-mix(in_oklab,var(--color-down)_8%,transparent)] p-3 font-mono text-[11px] text-[var(--color-down)]">
            {error}
          </pre>
        )}

        {result?.found && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 font-mono text-[11px] sm:grid-cols-3">
            {summarise(result).map(([k, v]) => (
              <div
                key={k}
                className="flex items-baseline justify-between gap-2"
              >
                <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
                  {k}
                </dt>
                <dd className="truncate text-[var(--color-fg)]">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {result !== null && (
          <pre className="max-h-80 overflow-auto border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 font-mono text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </Panel>
  );
}
