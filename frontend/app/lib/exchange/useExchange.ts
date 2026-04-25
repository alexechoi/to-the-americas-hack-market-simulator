"use client";

import { useEffect, useRef, useState } from "react";

import type { ExchangeSnapshot } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UseExchangeOptions {
  enabled?: boolean;
}

interface UseExchangeResult {
  snapshot: ExchangeSnapshot | null;
  /** True once we've received at least one snapshot from the server. */
  connected: boolean;
}

/**
 * Subscribes to the backend SSE stream and exposes the latest Snapshot.
 *
 * EventSource auto-reconnects on transient network failures. We do nothing
 * fancy on disconnect — the next event will arrive on its own.
 */
export function useExchange(
  options: UseExchangeOptions = {},
): UseExchangeResult {
  const { enabled = true } = options;
  const [snapshot, setSnapshot] = useState<ExchangeSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const url = `${API_BASE_URL}/exchange/stream`;
    const source = new EventSource(url);
    sourceRef.current = source;

    const onSnapshot = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ExchangeSnapshot;
        setSnapshot(data);
        setConnected(true);
      } catch (err) {
        console.error("Failed to parse exchange snapshot", err);
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
  }, [enabled]);

  return { snapshot, connected };
}
