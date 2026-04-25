"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { AgentReasoning } from "@/app/components/sim/AgentReasoning";
import { AgentSwarm } from "@/app/components/sim/AgentSwarm";
import { BackendNewsFeed } from "@/app/components/sim/BackendNewsFeed";
import { HeadlineInjector } from "@/app/components/sim/HeadlineInjector";
import { OrderBook } from "@/app/components/sim/OrderBook";
import { PriceChart } from "@/app/components/sim/PriceChart";
import { Button } from "@/app/components/ui/Button";
import { LiveDot } from "@/app/components/ui/LiveDot";
import { Logo } from "@/app/components/ui/Logo";
import { Panel } from "@/app/components/ui/Panel";
import { Tag } from "@/app/components/ui/Tag";
import { useExchange } from "@/app/lib/exchange/useExchange";
import { injectHeadline } from "@/app/lib/news/api";
import { useNews } from "@/app/lib/news/useNews";
import { useSimulation } from "@/app/lib/sim/useSimulation";

export default function SimPage() {
  const [paused, setPaused] = useState(false);
  const { snapshot, controls } = useSimulation({
    ticker: "NVDA",
    startPrice: 142.18,
    tickMs: 280,
  });
  const {
    snapshot: exchangeSnapshot,
    connected: exchangeConnected,
    pricePoints: exchangePricePoints,
    openPrice: exchangeOpenPrice,
    lastTrade: exchangeLastTrade,
    priceAt: exchangePriceAt,
  } = useExchange();
  const { headlines, connected: newsConnected } = useNews();

  const onInjectHeadline = useCallback(
    (title: string) => {
      // Mirror to the legacy mock (drives existing decision animations) AND publish
      // to the backend so real agents see the same anchored headline.
      controls.injectHeadline(title);
      injectHeadline({ source: "user", headline: title }).catch((err) => {
        console.error("news inject failed", err);
      });
    },
    [controls],
  );

  // Header price/change is now driven by the backend exchange (fair price), not the mock.
  const headerPrice = exchangeSnapshot?.fair ?? null;
  const headerOpen = exchangeOpenPrice;
  const change =
    headerPrice !== null && headerOpen !== null ? headerPrice - headerOpen : 0;
  const changePct =
    headerPrice !== null && headerOpen !== null && headerOpen !== 0
      ? (change / headerOpen) * 100
      : 0;

  const cohortStats = useMemo(() => {
    if (!snapshot) return { agents: 0, decisions: 0, news: 0, tps: 0 };
    const recentDecisions = snapshot.decisions.filter(
      (d) => d.ts > snapshot.simulatedAt - 1000,
    ).length;
    return {
      agents: snapshot.agents.length,
      decisions: snapshot.decisions.length,
      news: snapshot.news.length,
      tps: recentDecisions,
    };
  }, [snapshot]);

  const togglePause = () => {
    if (paused) {
      controls.resume();
      setPaused(false);
    } else {
      controls.pause();
      setPaused(true);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Compact instrument bar — replaces site header on /sim */}
      <header className="flex shrink-0 items-center gap-6 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-2.5">
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
          <h1 className="text-base font-semibold tracking-tight">
            {snapshot?.ticker ?? "NVDA"}
          </h1>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)] md:inline">
            NVIDIA Corp · single-name
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

        <div className="ml-auto flex items-center gap-5">
          <InlineStat label="Agents" value={cohortStats.agents} />
          <InlineStat label="Dec/s" value={cohortStats.tps} />
          <InlineStat label="Headlines" value={cohortStats.news} />
          <InlineStat label="Cycle" value={snapshot?.cycle ?? 0} />

          <div className="hidden h-6 w-px bg-[var(--color-line)] sm:block" />

          <LiveDot
            tone={paused ? "paused" : "live"}
            label={paused ? "Paused" : "Live"}
          />
          <Tag tone="muted">tickMs 280</Tag>
          <Button variant="outline" size="sm" onClick={togglePause}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Reset
          </Button>
        </div>
      </header>

      {/* Workspace fills remaining viewport */}
      <main className="grid min-h-0 flex-1 grid-cols-12 gap-3 p-3">
        {/* Left column · agent swarm hero */}
        <div className="col-span-12 flex min-h-0 lg:col-span-4">
          <Panel
            title="Agent swarm"
            caption={`${cohortStats.agents} agents · cohort layout`}
            right={
              <LiveDot
                label={paused ? "Paused" : "Acting"}
                tone={paused ? "paused" : "live"}
              />
            }
            flush
            className="min-h-0 flex-1"
            bodyClassName="min-h-0 flex-1 bg-grid-fine"
          >
            <AgentSwarm
              agents={snapshot?.agents ?? []}
              decisions={snapshot?.decisions ?? []}
              height={240}
            />
          </Panel>
        </div>

        {/* Center column · chart + order tape */}
        <div className="col-span-12 flex min-h-0 flex-col gap-3 lg:col-span-5">
          <Panel
            title="Price action"
            right={
              <div className="flex items-center gap-2">
                <Tag tone="neutral">Kyle λ · depth-weighted</Tag>
                <Tag tone="muted">evt {exchangeSnapshot?.event_tick ?? 0}</Tag>
              </div>
            }
            flush
            className="min-h-0 flex-[1.8]"
            bodyClassName="min-h-0 flex-1 bg-grid-fine relative"
          >
            {exchangePricePoints.length >= 2 && exchangeOpenPrice !== null ? (
              <PriceChart
                prices={exchangePricePoints}
                news={[]}
                ticker={snapshot?.ticker ?? "FAIR"}
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
            className="min-h-0 flex-1"
            bodyClassName="min-h-0 flex-1"
          >
            <OrderBook snapshot={exchangeSnapshot} />
          </Panel>
        </div>

        {/* Right column · news (compose + tape) + reasoning */}
        <div className="col-span-12 flex min-h-0 flex-col gap-3 lg:col-span-3">
          <Panel
            title="News"
            caption={
              headlines.length
                ? `${headlines.length} on tape · ↵ to inject`
                : "↵ to inject"
            }
            right={
              <LiveDot
                tone={newsConnected ? "live" : "paused"}
                label={newsConnected ? "Live" : "Connecting"}
              />
            }
            flush
            className="min-h-0 flex-[1.4]"
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
            title="Agent reasoning"
            caption="streaming"
            right={<Tag tone="neutral">{snapshot?.decisions.length ?? 0}</Tag>}
            flush
            className="min-h-0 flex-1"
            bodyClassName="min-h-0 flex-1 overflow-y-auto no-scrollbar"
          >
            <AgentReasoning decisions={snapshot?.decisions ?? []} />
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
