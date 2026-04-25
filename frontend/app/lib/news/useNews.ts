"use client";

import { useEffect, useRef, useState } from "react";

import type { NewsHeadline } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_CAP = 30;

interface UseNewsOptions {
  enabled?: boolean;
  /** Max headlines retained in the rolling buffer. */
  cap?: number;
}

interface UseNewsResult {
  /** Newest first. */
  headlines: NewsHeadline[];
  /** True once the SSE has produced at least one event. */
  connected: boolean;
}

/**
 * Subscribe to /news/stream. The backend primes the stream with up to N recent
 * headlines on connect, so we don't need a separate /news/recent fetch — every
 * subscriber gets the same warm-start.
 *
 * Dedup by `headline_id` so the prime + a live publish for the same item don't
 * double-render.
 */
export function useNews(options: UseNewsOptions = {}): UseNewsResult {
  const { enabled = true, cap = DEFAULT_CAP } = options;

  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const url = `${API_BASE_URL}/news/stream`;
    const source = new EventSource(url);
    sourceRef.current = source;

    const onHeadline = (e: MessageEvent) => {
      let data: NewsHeadline;
      try {
        data = JSON.parse(e.data) as NewsHeadline;
      } catch (err) {
        console.error("Failed to parse news headline", err);
        return;
      }
      setHeadlines((prev) => {
        if (prev.some((h) => h.headline_id === data.headline_id)) return prev;
        const next = [data, ...prev];
        return next.length > cap ? next.slice(0, cap) : next;
      });
    };

    source.addEventListener("headline", onHeadline as EventListener);
    // Use onopen — the bus only primes the stream if there are recent headlines, so
    // an empty backlog would otherwise leave us showing "connecting" forever.
    source.onopen = () => {
      setConnected(true);
    };
    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.removeEventListener("headline", onHeadline as EventListener);
      source.close();
      sourceRef.current = null;
    };
  }, [enabled, cap]);

  return { headlines, connected };
}
