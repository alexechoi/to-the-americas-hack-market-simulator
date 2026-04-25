"use client";

import { useMemo, useState } from "react";

import { Button } from "@/app/components/ui/Button";
import { submitOrder } from "@/app/lib/exchange/api";
import type {
  ExchangeSnapshot,
  LadderLevel,
  Trade,
} from "@/app/lib/exchange/types";

interface OrderBookProps {
  snapshot: ExchangeSnapshot | null;
  agentId?: string;
}

const MAX_TRADES = 10;

export function OrderBook({ snapshot, agentId = "manual" }: OrderBookProps) {
  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-fg-faint)]">
        Connecting to exchange…
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_220px] gap-px bg-[var(--color-line)]">
      <div className="min-h-0 overflow-hidden bg-[var(--color-surface)]">
        <Ladder snapshot={snapshot} />
      </div>
      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-px bg-[var(--color-line)]">
        <div className="bg-[var(--color-surface)] p-3">
          <SubmitFOK
            bestBid={snapshot.best_bid}
            bestAsk={snapshot.best_ask}
            agentId={agentId}
          />
        </div>
        <div className="min-h-0 overflow-hidden bg-[var(--color-surface)]">
          <RecentTrades trades={snapshot.recent_trades} />
        </div>
      </div>
    </div>
  );
}

// ---------- ladder ----------

interface AnnotatedLevel extends LadderLevel {
  cumSize: number;
  cumDollar: number;
}

const GRID_COLS = "grid-cols-[64px_1fr_1fr_1fr]";

function Ladder({ snapshot }: { snapshot: ExchangeSnapshot }) {
  const { ladder, best_bid, best_ask, recent_trades } = snapshot;
  const last =
    recent_trades.length > 0
      ? recent_trades[recent_trades.length - 1].vwap
      : null;

  // Asks: server delivers ascending; reverse so worst ask renders at top, best ask at bottom (touching the spread row).
  const asksTopDown = useMemo(() => [...ladder.asks].reverse(), [ladder.asks]);

  // Cumulate from the inside out so the row nearest the spread reads its own size,
  // and rows further away read the running total (mirrors Polymarket's TOTAL column).
  const asksAnnotated = useMemo<AnnotatedLevel[]>(() => {
    const out = asksTopDown.map((lvl) => ({
      ...lvl,
      cumSize: 0,
      cumDollar: 0,
    }));
    let cumSize = 0;
    let cumDollar = 0;
    for (let i = out.length - 1; i >= 0; i--) {
      cumSize += out[i].size;
      cumDollar += out[i].size * out[i].price;
      out[i].cumSize = cumSize;
      out[i].cumDollar = cumDollar;
    }
    return out;
  }, [asksTopDown]);

  const bidsAnnotated = useMemo<AnnotatedLevel[]>(() => {
    const out = ladder.bids.map((lvl) => ({
      ...lvl,
      cumSize: 0,
      cumDollar: 0,
    }));
    let cumSize = 0;
    let cumDollar = 0;
    for (let i = 0; i < out.length; i++) {
      cumSize += out[i].size;
      cumDollar += out[i].size * out[i].price;
      out[i].cumSize = cumSize;
      out[i].cumDollar = cumDollar;
    }
    return out;
  }, [ladder.bids]);

  const maxCum = useMemo(() => {
    let m = 1;
    for (const a of asksAnnotated) if (a.cumSize > m) m = a.cumSize;
    for (const b of bidsAnnotated) if (b.cumSize > m) m = b.cumSize;
    return m;
  }, [asksAnnotated, bidsAnnotated]);

  const spread = best_ask - best_bid;
  const bestAskIdx = asksAnnotated.length - 1;

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[11px] tabular-nums">
      <div
        className={`grid shrink-0 ${GRID_COLS} gap-x-3 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]`}
      >
        <span>Trade</span>
        <span className="text-right">Price</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col-reverse overflow-hidden">
          {asksAnnotated.map((lvl, i) => (
            <Row
              key={`a-${i}-${lvl.price}`}
              level={lvl}
              maxCum={maxCum}
              tone="ask"
              isBest={i === bestAskIdx}
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-y border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
          <span>
            Last:{" "}
            <span className="text-[var(--color-fg-muted)]">
              {last !== null ? last.toFixed(2) : "—"}
            </span>
          </span>
          <span className="ml-auto">
            Spread:{" "}
            <span className="text-[var(--color-fg-muted)]">
              {spread.toFixed(2)}
            </span>
          </span>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {bidsAnnotated.map((lvl, i) => (
            <Row
              key={`b-${i}-${lvl.price}`}
              level={lvl}
              maxCum={maxCum}
              tone="bid"
              isBest={i === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  level,
  maxCum,
  tone,
  isBest,
}: {
  level: AnnotatedLevel;
  maxCum: number;
  tone: "bid" | "ask";
  isBest: boolean;
}) {
  const pct = Math.max(0, Math.min(1, level.cumSize / maxCum));
  const color = tone === "bid" ? "var(--color-up)" : "var(--color-down)";
  return (
    <div
      className={`relative grid ${GRID_COLS} items-center gap-x-3 px-4 py-[3px]`}
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{
          width: `${pct * 100}%`,
          background: `linear-gradient(to left, color-mix(in oklab, ${color} 22%, transparent), color-mix(in oklab, ${color} 6%, transparent))`,
        }}
      />
      <span className="relative">{isBest && <SidePill tone={tone} />}</span>
      <span className="relative text-right" style={{ color }}>
        {level.price.toFixed(2)}
      </span>
      <span className="relative text-right text-[var(--color-fg-muted)]">
        {level.size.toLocaleString()}
      </span>
      <span className="relative text-right text-[var(--color-fg)]">
        $
        {level.cumDollar.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  );
}

function SidePill({ tone }: { tone: "bid" | "ask" }) {
  const color = tone === "bid" ? "var(--color-up)" : "var(--color-down)";
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.14em]"
      style={{
        background: `color-mix(in oklab, ${color} 18%, transparent)`,
        color,
      }}
    >
      {tone === "ask" ? "Asks" : "Bids"}
    </span>
  );
}

// ---------- recent trades ----------

function RecentTrades({ trades }: { trades: Trade[] }) {
  const recent = trades.slice(-MAX_TRADES).reverse();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        Recent fills
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 font-mono text-[11px] tabular-nums">
        {recent.length === 0 ? (
          <div className="pt-1 text-[var(--color-fg-faint)]">No fills yet.</div>
        ) : (
          recent.map((t, i) => {
            const isBuy = t.qty > 0;
            const color = isBuy ? "var(--color-up)" : "var(--color-down)";
            return (
              <div
                key={`t-${i}-${t.vwap}-${t.qty}`}
                className="grid grid-cols-[36px_1fr_64px] items-baseline gap-x-2 py-[2px]"
              >
                <span style={{ color }}>{isBuy ? "BUY" : "SELL"}</span>
                <span className="truncate text-[var(--color-fg-muted)]">
                  {t.agent_id} ×{Math.abs(t.qty).toLocaleString()}
                </span>
                <span className="text-right text-[var(--color-fg)]">
                  {t.vwap.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------- submit form ----------

type Side = "buy" | "sell";

function SubmitFOK({
  bestBid,
  bestAsk,
  agentId,
}: {
  bestBid: number;
  bestAsk: number;
  agentId: string;
}) {
  const [side, setSide] = useState<Side>("buy");
  const [qty, setQty] = useState<number>(5);
  const [limit, setLimit] = useState<number>(bestAsk);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Auto-suggest a sensible limit when the side changes (or first render).
  const suggested = side === "buy" ? bestAsk : bestBid;

  const setSideAndLimit = (next: Side) => {
    setSide(next);
    setLimit(next === "buy" ? bestAsk : bestBid);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const signed = side === "buy" ? Math.abs(qty) : -Math.abs(qty);
      const result = await submitOrder({
        agent_id: agentId,
        limit,
        qty: signed,
      });
      if (result.status === "filled") {
        setStatus(
          `filled ${side} ×${Math.abs(result.qty)} @ ${result.vwap.toFixed(2)}`,
        );
      } else if (result.status === "killed") {
        setStatus(`killed: ${humanizeReason(result.reason)}`);
      } else {
        setStatus("hold");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "submit failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        Submit FOK
      </div>
      <div className="grid grid-cols-2 gap-1">
        <SideButton
          active={side === "buy"}
          tone="buy"
          onClick={() => setSideAndLimit("buy")}
        >
          BUY
        </SideButton>
        <SideButton
          active={side === "sell"}
          tone="sell"
          onClick={() => setSideAndLimit("sell")}
        >
          SELL
        </SideButton>
      </div>
      <Field label="Qty">
        <input
          type="number"
          min={1}
          step={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className={inputClass}
        />
      </Field>
      <Field
        label={`Limit (best ${side === "buy" ? "ask" : "bid"} ${suggested.toFixed(2)})`}
      >
        <input
          type="number"
          step={0.01}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className={inputClass}
        />
      </Field>
      <Button
        type="submit"
        size="sm"
        variant={side === "buy" ? "accent" : "danger"}
        disabled={pending || qty <= 0}
      >
        {pending ? "…" : `Send ${side.toUpperCase()}`}
      </Button>
      {status && (
        <div className="font-mono text-[10px] text-[var(--color-fg-faint)]">
          {status}
        </div>
      )}
    </form>
  );
}

function humanizeReason(reason: string): string {
  switch (reason) {
    case "limit_not_crossed":
      return "limit didn't cross the inside";
    case "insufficient_liquidity":
      return "not enough liquidity to fill in full";
    default:
      return reason;
  }
}

const inputClass =
  "h-8 w-full border border-[var(--color-line-strong)] bg-[var(--color-bg)] px-2 font-mono text-[12px] tabular-nums text-[var(--color-fg)] outline-none focus:border-[var(--color-fg-faint)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SideButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "buy" | "sell";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const accentColor = tone === "buy" ? "var(--color-up)" : "var(--color-down)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 border font-mono text-[11px] tracking-[0.12em] transition-colors"
      style={{
        borderColor: active ? accentColor : "var(--color-line-strong)",
        color: active ? accentColor : "var(--color-fg-muted)",
        background: active
          ? `color-mix(in oklab, ${accentColor} 12%, transparent)`
          : "transparent",
      }}
    >
      {children}
    </button>
  );
}
