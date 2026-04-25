"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listAgents } from "./api";
import type {
  BackendAgent,
  ExchangeSnapshot,
  ExchangeState,
  OrderLogEntry,
  PricePoint,
  Trade,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_HISTORY_CAP = 600; // ~2 minutes at 5 Hz
// Ring of recent decisions held client-side. Bigger than the server buffer so a
// long demo doesn't lose context even if the server window has rolled past it.
const DEFAULT_ORDER_LOG_CAP = 400;

interface FairTick {
  tick_id: number;
  fair: number;
}

interface UseExchangeOptions {
  enabled?: boolean;
  /** Max points retained in the rolling price history. */
  historyCap?: number;
  /** Max entries retained in the rolling order log. */
  orderLogCap?: number;
}

interface UseExchangeResult {
  snapshot: ExchangeSnapshot | null;
  /** True once we've received at least one snapshot from the server. */
  connected: boolean;
  /** Rolling history of fair-price samples, one per backend tick we received. */
  pricePoints: PricePoint[];
  /** First fair value we observed in this session — used as the "open" reference. */
  openPrice: number | null;
  /** Latest fill from the server (or null if none yet). */
  lastTrade: Trade | null;
  /**
   * Returns the last observed fair at or before `tick_id`, or `null` if we
   * haven't seen anything yet. Mirrors the backend's `Exchange.price_at`.
   */
  priceAt: (tick_id: number) => number | null;
  /**
   * Rolling buffer of order-log entries, newest first. Driven by the
   * `order_log` SSE channel — covers every swarm decision (BUY/SELL/HOLD) and
   * every manual `/exchange/orders` submission. Server-side replay on
   * connection means a late mount immediately sees recent context.
   */
  orderLog: OrderLogEntry[];
  /** Live swarm roster fetched once on mount. Empty until the request resolves. */
  agents: BackendAgent[];
  /**
   * Latest order-log entry per agent_id. Used by the Agent Swarm canvas to
   * pulse a dot in the side colour the moment its agent decides something.
   */
  lastByAgent: Map<string, OrderLogEntry>;
  /**
   * Current ticker / display name / fair price the backend is simulating around.
   * Hydrated from the SSE `reset` event the server sends on every connect and
   * on every `/exchange/spawn`. ``null`` until the first event lands.
   */
  state: ExchangeState | null;
}

/**
 * Subscribes to the backend SSE stream and exposes:
 *   - the latest Snapshot
 *   - a rolling history of (t, price) suitable for charting
 *   - the session-open price (first fair we ever saw)
 *   - the most recent fill
 *   - the order-log stream (decisions + manual orders) and a per-agent index
 *   - the swarm roster (one-shot HTTP fetch on mount)
 *
 * EventSource auto-reconnects on transient network failures.
 */
export function useExchange(
  options: UseExchangeOptions = {},
): UseExchangeResult {
  const {
    enabled = true,
    historyCap = DEFAULT_HISTORY_CAP,
    orderLogCap = DEFAULT_ORDER_LOG_CAP,
  } = options;

  const [snapshot, setSnapshot] = useState<ExchangeSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [pricePoints, setPricePoints] = useState<PricePoint[]>([]);
  const [openPrice, setOpenPrice] = useState<number | null>(null);
  const [lastTrade, setLastTrade] = useState<Trade | null>(null);
  const [orderLog, setOrderLog] = useState<OrderLogEntry[]>([]);
  const [agents, setAgents] = useState<BackendAgent[]>([]);
  const [state, setState] = useState<ExchangeState | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  // Per-snapshot fingerprint of the latest trade we've already counted, so we can detect
  // genuinely new fills (recent_trades is a sliding window the server pushes every tick).
  const lastTradeFingerprintRef = useRef<string | null>(null);
  // Tick→fair timeline (monotonic by tick_id), used by `priceAt` for news pct anchors.
  // Held as a ref so the SSE effect doesn't re-fire on every append.
  const fairTimelineRef = useRef<FairTick[]>([]);
  // Set of order-log ids we've already ingested. Server replays the recent
  // buffer on every reconnect, so dedupe is essential for the in-memory ring.
  const seenOrderIdsRef = useRef<Set<string>>(new Set());

  const priceAt = useCallback((tick_id: number): number | null => {
    const tl = fairTimelineRef.current;
    if (tl.length === 0) return null;
    // Backward linear scan — tl is sorted ascending and most queries land near the tail.
    for (let i = tl.length - 1; i >= 0; i--) {
      if (tl[i].tick_id <= tick_id) return tl[i].fair;
    }
    return null;
  }, []);

  // One-shot fetch of the swarm roster. The backend list is static at startup,
  // so a single GET on mount is enough — no need to re-poll.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listAgents()
      .then((rows) => {
        if (!cancelled) setAgents(rows);
      })
      .catch((err) => {
        // Non-fatal: the swarm panel renders an empty layout until the call
        // succeeds. Logged so the user can spot a backend that's down.
        console.error("listAgents failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const url = `${API_BASE_URL}/exchange/stream`;
    const source = new EventSource(url);
    sourceRef.current = source;

    const onSnapshot = (e: MessageEvent) => {
      let data: ExchangeSnapshot;
      try {
        data = JSON.parse(e.data) as ExchangeSnapshot;
      } catch (err) {
        console.error("Failed to parse exchange snapshot", err);
        return;
      }

      setSnapshot(data);
      setConnected(true);

      const t = Date.now();

      setOpenPrice((prev) => (prev === null ? data.fair : prev));

      // Append to rolling buffer, capped at historyCap.
      setPricePoints((prev) => {
        const point: PricePoint = { t, price: data.fair, volume: 0 };
        if (prev.length >= historyCap) {
          // Slide the window: drop the oldest, append the newest.
          const next = prev.slice(prev.length - historyCap + 1);
          next.push(point);
          return next;
        }
        return [...prev, point];
      });

      // Append to the tick-keyed fair timeline (dedup if same tick_id has already landed).
      const tl = fairTimelineRef.current;
      const last = tl.length > 0 ? tl[tl.length - 1] : null;
      if (!last || last.tick_id !== data.tick_id) {
        tl.push({ tick_id: data.tick_id, fair: data.fair });
        if (tl.length > historyCap) {
          tl.splice(0, tl.length - historyCap);
        }
      }

      // Detect new fills by fingerprinting the latest trade.
      const latest = data.recent_trades[data.recent_trades.length - 1] ?? null;
      if (latest) {
        const fp = `${latest.vwap}:${latest.qty}:${latest.agent_id}:${latest.levels.length}`;
        if (fp !== lastTradeFingerprintRef.current) {
          lastTradeFingerprintRef.current = fp;
          setLastTrade(latest);
        }
      }
    };

    const onOrderLog = (e: MessageEvent) => {
      let entry: OrderLogEntry;
      try {
        entry = JSON.parse(e.data) as OrderLogEntry;
      } catch (err) {
        console.error("Failed to parse order_log entry", err);
        return;
      }
      // Dedupe — the server replays its buffer on every reconnect, and we
      // don't want duplicate rows piling up in the panel.
      if (seenOrderIdsRef.current.has(entry.id)) return;
      seenOrderIdsRef.current.add(entry.id);
      setOrderLog((prev) => {
        const next = [entry, ...prev];
        if (next.length > orderLogCap) {
          // Drop the oldest entries' ids from the dedupe set so memory stays bounded.
          for (const dropped of next.slice(orderLogCap)) {
            seenOrderIdsRef.current.delete(dropped.id);
          }
          return next.slice(0, orderLogCap);
        }
        return next;
      });
    };

    const onReset = (e: MessageEvent) => {
      let data: ExchangeState;
      try {
        data = JSON.parse(e.data) as ExchangeState;
      } catch (err) {
        console.error("Failed to parse reset envelope", err);
        return;
      }
      // Adopt the new ticker context. The server primes this once on connect
      // and broadcasts a fresh one on every /exchange/spawn — we treat both
      // identically: drop everything tied to the previous universe.
      setState(data);
      setOpenPrice(data.fair);
      setPricePoints([]);
      setLastTrade(null);
      setOrderLog([]);
      fairTimelineRef.current = [];
      lastTradeFingerprintRef.current = null;
      seenOrderIdsRef.current.clear();
    };

    source.addEventListener("snapshot", onSnapshot as EventListener);
    source.addEventListener("order_log", onOrderLog as EventListener);
    source.addEventListener("reset", onReset as EventListener);
    source.onerror = () => {
      // EventSource will retry automatically; we just mark not-connected.
      setConnected(false);
    };

    return () => {
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.removeEventListener("order_log", onOrderLog as EventListener);
      source.removeEventListener("reset", onReset as EventListener);
      source.close();
      sourceRef.current = null;
    };
  }, [enabled, historyCap, orderLogCap]);

  // Latest entry per agent — used by the swarm canvas to pulse the right dot.
  // Memoised on the order-log ref so we don't rebuild the map for every render.
  const lastByAgent = useMemo(() => {
    const m = new Map<string, OrderLogEntry>();
    // orderLog is newest-first, so the first entry we see for an agent is the
    // most recent one and we can short-circuit further updates.
    for (const e of orderLog) {
      if (!m.has(e.agentId)) m.set(e.agentId, e);
    }
    return m;
  }, [orderLog]);

  return {
    snapshot,
    connected,
    pricePoints,
    openPrice,
    lastTrade,
    priceAt,
    orderLog,
    agents,
    lastByAgent,
    state,
  };
}
