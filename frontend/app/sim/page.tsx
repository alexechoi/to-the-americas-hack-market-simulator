"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AgentSwarm } from "@/app/components/sim/AgentSwarm";
import { BackendNewsFeed } from "@/app/components/sim/BackendNewsFeed";
import { HeadlineInjector } from "@/app/components/sim/HeadlineInjector";
import { OrderBook } from "@/app/components/sim/OrderBook";
import { OrderLog } from "@/app/components/sim/OrderLog";
import { PriceChart } from "@/app/components/sim/PriceChart";
import { Button } from "@/app/components/ui/Button";
import { LiveDot } from "@/app/components/ui/LiveDot";
import { Logo } from "@/app/components/ui/Logo";
import { Panel } from "@/app/components/ui/Panel";
import { Tag } from "@/app/components/ui/Tag";
import { useExchange } from "@/app/lib/exchange/useExchange";
import { injectHeadline } from "@/app/lib/news/api";
import { useNews } from "@/app/lib/news/useNews";

// Cold-start placeholders shown only until the SSE `reset` event lands. The
// backend always primes that envelope on connect, so this is just to avoid a
// brief "—" flash on the very first paint.
const PLACEHOLDER_TICKER = "NVDA";
const PLACEHOLDER_NAME = "NVIDIA Corp";

export default function SimPage() {
  const {
    snapshot: exchangeSnapshot,
    connected: exchangeConnected,
    pricePoints: exchangePricePoints,
    openPrice: exchangeOpenPrice,
    lastTrade: exchangeLastTrade,
    priceAt: exchangePriceAt,
    orderLog,
    agents,
    lastByAgent,
    state: exchangeState,
  } = useExchange();

  const ticker = exchangeState?.ticker ?? PLACEHOLDER_TICKER;
  const tickerName = exchangeState?.name ?? PLACEHOLDER_NAME;
  const { headlines, connected: newsConnected } = useNews();

  const onInjectHeadline = useCallback((title: string) => {
    injectHeadline({ source: "user", headline: title }).catch((err) => {
      console.error("news inject failed", err);
    });
  }, []);

  // Header price/change is driven by the backend exchange (fair price).
  const headerPrice = exchangeSnapshot?.fair ?? null;
  const headerOpen = exchangeOpenPrice;
  const change =
    headerPrice !== null && headerOpen !== null ? headerPrice - headerOpen : 0;
  const changePct =
    headerPrice !== null && headerOpen !== null && headerOpen !== 0
      ? (change / headerOpen) * 100
      : 0;

  // 2 Hz wall-clock tick used by the Dec/s window. Kept as state instead of
  // `Date.now()` inside useMemo so the memo body stays pure (React 19 rule),
  // and so the value naturally decays to 0 when decisions stop coming in.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Inline header stats — all sourced from the real exchange + roster.
  const cohortStats = useMemo(() => {
    const recent = orderLog.filter((d) => d.ts > nowMs - 1000).length;
    return {
      agents: agents.length,
      decisions: orderLog.length,
      news: headlines.length,
      tps: recent,
      cycle: exchangeSnapshot?.event_tick ?? 0,
    };
  }, [
    agents.length,
    orderLog,
    headlines.length,
    exchangeSnapshot?.event_tick,
    nowMs,
  ]);

  return (
    // Mobile/tablet: natural document flow, the page scrolls. Desktop (lg+):
    // locked-in cockpit — viewport height with no outer scroll. This avoids
    // the "panels squashed to 0px because the parent is overflow-hidden but
    // every column collapsed to col-span-12" trap we used to have.
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg)] text-[var(--color-fg)] lg:h-dvh lg:overflow-hidden">
      {/* Compact instrument bar — wraps on small screens so it never overflows */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 sm:gap-x-6 sm:px-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
          aria-label="Back to Animal Spirits home"
        >
          <Logo size={16} />
          <span className="text-sm font-semibold tracking-tight">
            Animal Spirits
          </span>
        </Link>

        <div className="hidden h-6 w-px bg-[var(--color-line)] sm:block" />

        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight">{ticker}</h1>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)] md:inline">
            {tickerName} · single-name
          </span>
        </div>

        <div className="flex items-baseline gap-2 font-mono tabular-nums">
          <span className="text-xl tracking-tight text-[var(--color-fg)]">
            {headerPrice !== null ? headerPrice.toFixed(2) : "—"}
          </span>
          <span
            className="text-xs"
            style={{
              color: change >= 0 ? "var(--color-up)" : "var(--color-down)",
            }}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)} ({changePct >= 0 ? "+" : ""}
            {changePct.toFixed(2)}%)
          </span>
          {exchangeLastTrade && (
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)] xl:inline">
              last fill {exchangeLastTrade.vwap.toFixed(2)} ×
              {Math.abs(exchangeLastTrade.qty)}
            </span>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5">
          <InlineStat label="Agents" value={cohortStats.agents} />
          <InlineStat label="Dec/s" value={cohortStats.tps} />
          <InlineStat label="Headlines" value={cohortStats.news} />
          <InlineStat label="Cycle" value={cohortStats.cycle} />

          <div className="hidden h-6 w-px bg-[var(--color-line)] sm:block" />

          <LiveDot
            tone={exchangeConnected ? "live" : "paused"}
            label={exchangeConnected ? "Live" : "Connecting"}
          />
          <span className="hidden sm:inline-flex">
            <Tag tone="muted">tickMs 200</Tag>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Reset
          </Button>
        </div>
      </header>

      {/* Workspace
       * - Mobile/tablet: single column stack with explicit panel heights so
       *   each panel has a usable size and the page scrolls naturally.
       * - lg+: the original 12-col cockpit, locked to the remaining viewport
       *   height. */}
      <main className="grid grid-cols-1 gap-3 p-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:overflow-hidden">
        {/* Left column · agent swarm hero */}
        <div className="flex h-[360px] flex-col lg:col-span-4 lg:h-auto lg:min-h-0">
          <Panel
            title="Agent swarm"
            caption={`${cohortStats.agents} agents · cohort layout`}
            right={
              <LiveDot
                label={exchangeConnected ? "Acting" : "Connecting"}
                tone={exchangeConnected ? "live" : "paused"}
              />
            }
            flush
            className="min-h-0 flex-1"
            bodyClassName="min-h-0 flex-1 bg-grid-fine"
          >
            <AgentSwarm
              agents={agents}
              lastByAgent={lastByAgent}
              height={240}
            />
          </Panel>
        </div>

        {/* Center column · chart + order book */}
        <div className="flex flex-col gap-3 lg:col-span-5 lg:min-h-0">
          <Panel
            title="Price action"
            right={
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex">
                  <Tag tone="neutral">Kyle λ · depth-weighted</Tag>
                </span>
                <Tag tone="muted">evt {exchangeSnapshot?.event_tick ?? 0}</Tag>
              </div>
            }
            flush
            className="h-[360px] lg:h-auto lg:min-h-0 lg:flex-[1.8]"
            bodyClassName="min-h-0 flex-1 bg-grid-fine relative"
          >
            {exchangePricePoints.length >= 2 && exchangeOpenPrice !== null ? (
              <PriceChart
                prices={exchangePricePoints}
                news={[]}
                ticker={ticker}
                openPrice={exchangeOpenPrice}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--color-fg-faint)]">
                {exchangeConnected
                  ? "Buffering ticks…"
                  : "Connecting to exchange…"}
              </div>
            )}
          </Panel>

          <Panel
            title="Order book"
            caption={exchangeSnapshot ? undefined : "connecting…"}
            right={
              <LiveDot
                tone={exchangeConnected ? "live" : "paused"}
                label={exchangeConnected ? "Live" : "Connecting"}
              />
            }
            flush
            className="h-[320px] lg:h-auto lg:min-h-0 lg:flex-1"
            bodyClassName="min-h-0 flex-1"
          >
            <OrderBook snapshot={exchangeSnapshot} />
          </Panel>
        </div>

        {/* Right column · news (compose + tape) + order log */}
        <div className="flex flex-col gap-3 lg:col-span-3 lg:min-h-0">
          <Panel
            title="News"
            caption={undefined}
            right={
              <LiveDot
                tone={newsConnected ? "live" : "paused"}
                label={newsConnected ? "Live" : "Connecting"}
              />
            }
            flush
            className="h-[420px] lg:h-auto lg:min-h-0 lg:flex-[1.4]"
            bodyClassName="min-h-0 flex-1 flex flex-col"
          >
            {/* Compose row — flush so the panel border owns the outer edge. */}
            <div className="border-b border-[var(--color-line)]">
              <HeadlineInjector onInject={onInjectHeadline} flush />
            </div>
            {/* Tape — scrollable feed below the compose row. */}
            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
              <BackendNewsFeed
                headlines={headlines}
                currentFair={exchangeSnapshot?.fair ?? null}
                priceAt={exchangePriceAt}
                emptyHint={
                  newsConnected
                    ? "Awaiting first headline."
                    : "Connecting to news feed…"
                }
              />
            </div>
          </Panel>

          <Panel
            title="Order log"
            caption="streaming"
            right={<Tag tone="neutral">{cohortStats.decisions}</Tag>}
            flush
            className="h-[320px] lg:h-auto lg:min-h-0 lg:flex-1"
            bodyClassName="min-h-0 flex-1 overflow-y-auto no-scrollbar"
          >
            <OrderLog entries={orderLog} />
          </Panel>
        </div>
      </main>
    </div>
  );
}

function InlineStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="hidden items-baseline gap-1.5 md:flex">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums text-[var(--color-fg)]">
        {value}
      </span>
    </div>
  );
}
