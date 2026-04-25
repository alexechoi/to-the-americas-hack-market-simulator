"use client";

import { useMemo, useState } from "react";

import { AgentReasoning } from "@/app/components/sim/AgentReasoning";
import { AgentSwarm } from "@/app/components/sim/AgentSwarm";
import { CohortLegend } from "@/app/components/sim/CohortLegend";
import { HeadlineInjector } from "@/app/components/sim/HeadlineInjector";
import { NewsFeed } from "@/app/components/sim/NewsFeed";
import { OrderTape } from "@/app/components/sim/OrderTape";
import { PriceChart } from "@/app/components/sim/PriceChart";
import { ScenarioTable } from "@/app/components/sim/ScenarioTable";
import { TickerStrip } from "@/app/components/sim/TickerStrip";
import { Button } from "@/app/components/ui/Button";
import { Footer } from "@/app/components/ui/Footer";
import { Header } from "@/app/components/ui/Header";
import { LiveDot } from "@/app/components/ui/LiveDot";
import { Panel } from "@/app/components/ui/Panel";
import { Stat } from "@/app/components/ui/Stat";
import { Tag } from "@/app/components/ui/Tag";
import { useSimulation } from "@/app/lib/sim/useSimulation";

export default function SimPage() {
  const [paused, setPaused] = useState(false);
  const { snapshot, controls } = useSimulation({
    ticker: "NVDA",
    startPrice: 142.18,
    tickMs: 280,
  });

  const change = snapshot ? snapshot.price - snapshot.openPrice : 0;
  const changePct = snapshot ? (change / snapshot.openPrice) * 100 : 0;

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
    <div className="flex min-h-screen flex-col">
      <Header />
      <TickerStrip />

      {/* Sticky instrument bar */}
      <div className="sticky top-14 z-20 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight">
              {snapshot?.ticker ?? "NVDA"}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
                NVIDIA Corp · single-name
              </span>
            </h1>
          </div>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl tracking-tight text-[var(--color-fg)]">
              {snapshot?.price.toFixed(2) ?? "—"}
            </span>
            <span
              className="text-sm"
              style={{
                color: change >= 0 ? "var(--color-up)" : "var(--color-down)",
              }}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)} ({changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <LiveDot
              tone={paused ? "paused" : "live"}
              label={paused ? "Paused" : `Live · ${cohortStats.tps}/s`}
            />
            <Tag tone="muted">cycle {snapshot?.cycle ?? 0}</Tag>
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
        </div>
      </div>

      {/* Workspace grid */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Left column · cohorts */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            <Panel
              title="Population"
              caption={`${cohortStats.agents} agents`}
              right={<Tag tone="muted">8 archetypes</Tag>}
              flush
              bodyClassName=""
            >
              <CohortLegend
                agents={snapshot?.agents ?? []}
                decisions={snapshot?.decisions ?? []}
                referenceTs={snapshot?.simulatedAt ?? 0}
              />
            </Panel>

            <Panel title="Inject headline" caption="⌘↵" className="">
              <HeadlineInjector onInject={controls.injectHeadline} />
            </Panel>
          </div>

          {/* Center column · chart + swarm + tape */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
            <Panel
              title="Price action"
              caption={`${snapshot?.prices.length ?? 0} ticks`}
              right={
                <div className="flex items-center gap-2">
                  <Tag tone="neutral">AMM · √-impact</Tag>
                  <Tag tone="muted">tickMs 280</Tag>
                </div>
              }
              bodyClassName="px-0 pb-0 pt-0"
              flush
            >
              <div className="bg-grid-fine relative h-[360px] w-full">
                {snapshot && (
                  <PriceChart
                    prices={snapshot.prices}
                    news={snapshot.news}
                    ticker={snapshot.ticker}
                    openPrice={snapshot.openPrice}
                  />
                )}
              </div>
            </Panel>

            <div className="grid grid-cols-2 gap-4">
              <Panel
                title="Agent swarm"
                caption="cohort layout"
                right={
                  <LiveDot
                    label={paused ? "Paused" : "Acting"}
                    tone={paused ? "paused" : "live"}
                  />
                }
                flush
                bodyClassName=""
              >
                <div className="bg-grid-fine">
                  <AgentSwarm
                    agents={snapshot?.agents ?? []}
                    decisions={snapshot?.decisions ?? []}
                  />
                </div>
              </Panel>
              <Panel
                title="Order tape"
                caption="last 14 fills"
                flush
                bodyClassName=""
              >
                <OrderTape decisions={snapshot?.decisions ?? []} />
              </Panel>
            </div>

            <Panel
              title="Scenario probability"
              caption="from population dispersion"
              right={<Tag tone="accent">Sellable output</Tag>}
              flush
              bodyClassName="overflow-x-auto"
            >
              <ScenarioTable rows={snapshot?.scenarios ?? []} />
            </Panel>
          </div>

          {/* Right column · news + reasoning */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            <Panel
              title="News tape"
              caption={`${cohortStats.news} headlines`}
              flush
              bodyClassName=""
            >
              <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                <NewsFeed news={snapshot?.news ?? []} />
              </div>
            </Panel>

            <Panel
              title="Agent reasoning"
              caption="streaming"
              right={
                <Tag tone="neutral">{snapshot?.decisions.length ?? 0}</Tag>
              }
              flush
              bodyClassName=""
            >
              <div className="max-h-[520px] overflow-y-auto no-scrollbar">
                <AgentReasoning decisions={snapshot?.decisions ?? []} />
              </div>
            </Panel>
          </div>
        </div>

        {/* Bottom strip · KPI bar */}
        <div className="mt-6 grid grid-cols-2 gap-4 border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="Agents" value={cohortStats.agents} mono />
          <Stat label="Decisions / sec" value={cohortStats.tps} mono />
          <Stat
            label="Open"
            value={snapshot?.openPrice.toFixed(2) ?? "—"}
            mono
          />
          <Stat
            label="Last"
            value={snapshot?.price.toFixed(2) ?? "—"}
            delta={changePct}
            mono
          />
          <Stat label="Headlines" value={cohortStats.news} mono />
          <Stat label="Cycle" value={snapshot?.cycle ?? 0} mono />
        </div>
      </main>

      <Footer />
    </div>
  );
}
