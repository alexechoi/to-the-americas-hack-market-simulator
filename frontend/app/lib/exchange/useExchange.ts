"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PricePoint } from "@/app/lib/sim/types";

import type { ExchangeSnapshot, Trade } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_HISTORY_CAP = 600; // ~2 minutes at 5 Hz

interface FairTick {
  tick_id: number;
  fair: number;
}

interface UseExchangeOptions {
  enabled?: boolean;
  /** Max points retained in the rolling price history. */
  historyCap?: number;
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
}

/**
 * Subscribes to the backend SSE stream and exposes:
 *   - the latest Snapshot
 *   - a rolling history of (t, price) suitable for charting
 *   - the session-open price (first fair we ever saw)
 *   - the most recent fill
 *
 * EventSource auto-reconnects on transient network failures.
 */
export function useExchange(
  options: UseExchangeOptions = {},
): UseExchangeResult {
  const { enabled = true, historyCap = DEFAULT_HISTORY_CAP } = options;

  const [snapshot, setSnapshot] = useState<ExchangeSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [pricePoints, setPricePoints] = useState<PricePoint[]>([]);
  const [openPrice, setOpenPrice] = useState<number | null>(null);
  const [lastTrade, setLastTrade] = useState<Trade | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  // Per-snapshot fingerprint of the latest trade we've already counted, so we can detect
  // genuinely new fills (recent_trades is a sliding window the server pushes every tick).
  const lastTradeFingerprintRef = useRef<string | null>(null);
  // Tick→fair timeline (monotonic by tick_id), used by `priceAt` for news pct anchors.
  // Held as a ref so the SSE effect doesn't re-fire on every append.
  const fairTimelineRef = useRef<FairTick[]>([]);

  const priceAt = useCallback((tick_id: number): number | null => {
    const tl = fairTimelineRef.current;
    if (tl.length === 0) return null;
    // Backward linear scan — tl is sorted ascending and most queries land near the tail.
    for (let i = tl.length - 1; i >= 0; i--) {
      if (tl[i].tick_id <= tick_id) return tl[i].fair;
    }
    return null;
  }, []);

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

    source.addEventListener("snapshot", onSnapshot as EventListener);
    source.onerror = () => {
      // EventSource will retry automatically; we just mark not-connected.
      setConnected(false);
    };

    return () => {
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.close();
      sourceRef.current = null;
    };
  }, [enabled, historyCap]);

  return {
    snapshot,
    connected,
    pricePoints,
    openPrice,
    lastTrade,
    priceAt,
  };
}
