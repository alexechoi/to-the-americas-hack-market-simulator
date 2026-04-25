"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { type EngineOptions, MarketEngine } from "./engine";
import type { SimSnapshot } from "./types";

export interface UseSimulationOptions extends Partial<EngineOptions> {
  enabled?: boolean;
}

export function useSimulation(options: UseSimulationOptions = {}) {
  const {
    ticker = "NVDA",
    startPrice = 142.18,
    tickMs = 280,
    seed,
    enabled = true,
  } = options;

  const engineRef = useRef<MarketEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const engine = new MarketEngine({
      ticker,
      startPrice,
      tickMs,
      seed,
    });
    engineRef.current = engine;
    const unsub = engine.subscribe(setSnapshot);
    engine.start();
    return () => {
      unsub();
      engine.stop();
      engineRef.current = null;
    };
  }, [enabled, ticker, startPrice, tickMs, seed]);

  const controls = useMemo(
    () => ({
      pause: () => engineRef.current?.setPaused(true),
      resume: () => engineRef.current?.setPaused(false),
      injectHeadline: (title: string, sentiment: number) =>
        engineRef.current?.injectHeadline(title, sentiment),
    }),
    [],
  );

  return { snapshot, controls };
}
