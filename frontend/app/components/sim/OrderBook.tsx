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

function Ladder({ snapshot }: { snapshot: ExchangeSnapshot }) {
  const { ladder, fair, best_bid, best_ask } = snapshot;

  // Reverse asks so the level closest to the inside renders nearest the spread line.
  const asksTopDown = useMemo(() => [...ladder.asks].reverse(), [ladder.asks]);

  const maxSize = useMemo(() => {
    let m = 1;
    for (const lvl of ladder.bids) if (lvl.size > m) m = lvl.size;
    for (const lvl of ladder.asks) if (lvl.size > m) m = lvl.size;
    return m;
  }, [ladder]);

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[11px] tabular-nums">
      <div className="grid shrink-0 grid-cols-[1fr_60px_72px] gap-x-3 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        <span>Depth</span>
        <span className="text-right">Size</span>
        <span className="text-right">Price</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col-reverse overflow-hidden">
          {asksTopDown.map((lvl, i) => (
            <Row
              key={`a-${i}-${lvl.price}`}
              level={lvl}
              maxSize={maxSize}
              tone="ask"
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between border-y border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
            Fair
          </span>
          <span className="font-mono text-sm tabular-nums text-[var(--color-fg)]">
            {fair.toFixed(2)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
            spread {(best_ask - best_bid).toFixed(2)}
          </span>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {ladder.bids.map((lvl, i) => (
            <Row
              key={`b-${i}-${lvl.price}`}
              level={lvl}
              maxSize={maxSize}
              tone="bid"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  level,
  maxSize,
  tone,
}: {
  level: LadderLevel;
  maxSize: number;
  tone: "bid" | "ask";
}) {
  const pct = Math.max(0, Math.min(1, level.size / maxSize));
  const color = tone === "bid" ? "var(--color-up)" : "var(--color-down)";
  return (
    <div className="relative grid grid-cols-[1fr_60px_72px] items-center gap-x-3 px-4 py-[3px]">
      <div
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{
          width: `${pct * 100}%`,
          background:
            tone === "bid"
              ? "linear-gradient(to left, color-mix(in oklab, var(--color-up) 18%, transparent), transparent)"
              : "linear-gradient(to left, color-mix(in oklab, var(--color-down) 18%, transparent), transparent)",
        }}
      />
      <span className="relative" />
      <span className="relative text-right text-[var(--color-fg-muted)]">
        {level.size.toLocaleString()}
      </span>
      <span className="relative text-right" style={{ color }}>
        {level.price.toFixed(2)}
      </span>
    </div>
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
      await submitOrder({ agent_id: agentId, limit, qty: signed });
      setStatus(`queued ${side} ×${qty} @ ${limit.toFixed(2)}`);
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
