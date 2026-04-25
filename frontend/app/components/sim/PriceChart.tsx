"use client";

import { useEffect, useMemo, useState } from "react";

import type { PricePoint } from "@/app/lib/exchange/types";
import type { NewsHeadline } from "@/app/lib/news/types";

interface PriceChartProps {
  prices: PricePoint[];
  news: NewsHeadline[];
  width?: number;
  height?: number;
  ticker: string;
  openPrice: number;
}

const PADDING = { top: 28, right: 56, bottom: 32, left: 0 };
// Width of the transparent hit-target draped over each headline line. The chart
// uses preserveAspectRatio="none" so this is in viewBox units, not screen px.
const MARKER_HIT_W = 18;

interface NewsMarker {
  id: string;
  x: number;
  ts: number;
  source: string;
  headline: string;
  injected: boolean;
}

export function PriceChart({
  prices,
  news,
  width = 920,
  height = 360,
  ticker,
  openPrice,
}: PriceChartProps) {
  const { path, realPath, areaPath, points, yTicks, xTicks, lastPoint, scale } =
    useMemo(() => buildChart(prices, width, height), [prices, width, height]);

  const newsMarkers = useMemo<NewsMarker[]>(() => {
    if (!points.length) return [];
    const tStart = points[0].t;
    const tEnd = points[points.length - 1].t;
    const span = Math.max(1, tEnd - tStart);
    const innerW = width - PADDING.left - PADDING.right;
    return news
      .map((n) => {
        // Backend ships ts in unix seconds; PricePoint.t is wall-clock ms.
        const tsMs = n.ts * 1000;
        return { n, tsMs };
      })
      .filter(({ tsMs }) => tsMs >= tStart - 5000 && tsMs <= tEnd + 1000)
      .map(({ n, tsMs }) => ({
        id: n.headline_id,
        ts: tsMs,
        source: n.source,
        headline: n.headline,
        // The "user" source is what HeadlineInjector uses for manual injects;
        // visually we still want to call those out vs backend-driven headlines.
        injected: n.source === "user",
        x: PADDING.left + ((tsMs - tStart) / span) * innerW,
      }));
  }, [news, points, width]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredMarker = useMemo(
    () => (hoveredId ? newsMarkers.find((m) => m.id === hoveredId) : null),
    [hoveredId, newsMarkers],
  );

  // 1 Hz wall-clock tick so the tooltip's "Xs ago" stays fresh without polling
  // Date.now() during render. Mirrors the pattern in BackendNewsFeed.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const lastClose = lastPoint?.price ?? openPrice;
  const change = lastClose - openPrice;
  const changePct = (change / openPrice) * 100;
  const tone = change >= 0 ? "var(--color-up)" : "var(--color-down)";

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <clipPath id="chart-clip">
            <rect
              x={PADDING.left}
              y={PADDING.top}
              width={width - PADDING.left - PADDING.right}
              height={height - PADDING.top - PADDING.bottom}
            />
          </clipPath>
        </defs>

        {/* horizontal grid */}
        {yTicks.map((t) => (
          <g key={`y-${t.value}`}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-line)"
              strokeDasharray="2 4"
              strokeWidth={1}
            />
            <text
              x={width - PADDING.right + 8}
              y={t.y + 3}
              fill="var(--color-fg-faint)"
              fontSize={10}
              fontFamily="var(--font-mono)"
              textAnchor="start"
            >
              {t.value.toFixed(2)}
            </text>
          </g>
        ))}

        {/* vertical grid (time) */}
        {xTicks.map((t) => (
          <g key={`x-${t.x}`}>
            <line
              x1={t.x}
              x2={t.x}
              y1={PADDING.top}
              y2={height - PADDING.bottom}
              stroke="var(--color-line)"
              strokeDasharray="2 4"
              strokeWidth={1}
            />
            <text
              x={t.x}
              y={height - PADDING.bottom + 18}
              fill="var(--color-fg-faint)"
              fontSize={10}
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* open line */}
        {scale && (
          <line
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={scale.toY(openPrice)}
            y2={scale.toY(openPrice)}
            stroke="var(--color-fg-faint)"
            strokeDasharray="3 5"
            strokeWidth={1}
          />
        )}

        {/* news markers */}
        <g clipPath="url(#chart-clip)">
          {newsMarkers.map((n) => {
            const isHovered = n.id === hoveredId;
            return (
              <g
                key={n.id}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() =>
                  setHoveredId((curr) => (curr === n.id ? null : curr))
                }
                style={{ cursor: "pointer" }}
              >
                <line
                  x1={n.x}
                  x2={n.x}
                  y1={PADDING.top}
                  y2={height - PADDING.bottom}
                  stroke={
                    n.injected
                      ? "var(--color-accent)"
                      : "color-mix(in oklab, var(--color-fg-muted) 50%, transparent)"
                  }
                  strokeWidth={isHovered ? 2 : n.injected ? 1.4 : 1}
                  strokeDasharray={n.injected ? "0" : "3 3"}
                  opacity={isHovered ? 1 : 0.95}
                />
                <circle
                  cx={n.x}
                  cy={PADDING.top + 6}
                  r={isHovered ? 4 : 3}
                  fill={
                    n.injected ? "var(--color-accent)" : "var(--color-fg-muted)"
                  }
                />
                {/* Wider transparent hit-target so the line is easy to grab. */}
                <rect
                  x={n.x - MARKER_HIT_W / 2}
                  y={PADDING.top}
                  width={MARKER_HIT_W}
                  height={height - PADDING.top - PADDING.bottom}
                  fill="transparent"
                  pointerEvents="all"
                />
              </g>
            );
          })}
        </g>

        {/* area under price (subtle, no gradient — solid color-mix tint) */}
        <path
          d={areaPath}
          fill={`color-mix(in oklab, ${tone} 12%, transparent)`}
        />

        {/* real-price comparison (if any) */}
        {realPath && (
          <path
            d={realPath}
            fill="none"
            stroke="var(--color-fg-faint)"
            strokeWidth={1.25}
            strokeDasharray="2 3"
          />
        )}

        {/* simulated price */}
        <path d={path} fill="none" stroke={tone} strokeWidth={1.6} />

        {/* end-of-line dot */}
        {lastPoint && scale && (
          <g>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={scale.toY(lastPoint.price)}
              y2={scale.toY(lastPoint.price)}
              stroke={tone}
              strokeWidth={1}
              strokeDasharray="1 3"
              opacity={0.4}
            />
            <circle
              cx={scale.toX(lastPoint.t)}
              cy={scale.toY(lastPoint.price)}
              r={3}
              fill={tone}
            />
            <rect
              x={width - PADDING.right + 2}
              y={scale.toY(lastPoint.price) - 9}
              width={48}
              height={18}
              fill={tone}
            />
            <text
              x={width - PADDING.right + 26}
              y={scale.toY(lastPoint.price) + 4}
              fill="var(--color-bg)"
              fontSize={11}
              fontFamily="var(--font-mono)"
              fontWeight={600}
              textAnchor="middle"
            >
              {lastPoint.price.toFixed(2)}
            </text>
          </g>
        )}
      </svg>

      {/* headline tooltip — anchored to the hovered marker. Uses a % of chart
          extent so it tracks the SVG's stretched coordinate space. */}
      {hoveredMarker && (
        <NewsMarkerTooltip
          marker={hoveredMarker}
          chartW={width}
          chartH={height}
          now={now}
        />
      )}

      {/* corner overlay: ticker, last, change */}
      <div className="pointer-events-none absolute left-4 top-3 flex items-baseline gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
          {ticker} · 1m
        </span>
        <span
          className="font-mono text-xs tabular-nums"
          style={{ color: tone }}
        >
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)} ({changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%)
        </span>
      </div>

      {/* legend */}
      <div className="pointer-events-none absolute bottom-2 left-4 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-[2px] w-4"
            style={{ background: tone }}
          />
          Price
        </span>
        {realPath && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4 border-t border-dashed border-[var(--color-fg-faint)]" />
            Realised
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-[2px] bg-[var(--color-accent)]" />
          Injected headline
        </span>
      </div>
    </div>
  );
}

interface ChartGeometry {
  path: string;
  realPath: string | null;
  areaPath: string;
  points: PricePoint[];
  yTicks: { value: number; y: number }[];
  xTicks: { x: number; label: string }[];
  lastPoint: PricePoint | undefined;
  scale: { toX: (t: number) => number; toY: (p: number) => number } | null;
}

function buildChart(
  prices: PricePoint[],
  width: number,
  height: number,
): ChartGeometry {
  if (prices.length < 2) {
    return {
      path: "",
      realPath: null,
      areaPath: "",
      points: prices,
      yTicks: [],
      xTicks: [],
      lastPoint: prices[prices.length - 1],
      scale: null,
    };
  }
  const allValues: number[] = [];
  for (const p of prices) {
    allValues.push(p.price);
    if (p.realPrice !== undefined) allValues.push(p.realPrice);
  }
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const pad = (max - min) * 0.18 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const tStart = prices[0].t;
  const tEnd = prices[prices.length - 1].t;
  const tSpan = Math.max(1, tEnd - tStart);

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const toX = (t: number) => PADDING.left + ((t - tStart) / tSpan) * innerW;
  const toY = (p: number) =>
    PADDING.top + (1 - (p - yMin) / (yMax - yMin)) * innerH;

  const path = prices
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.t)} ${toY(p.price)}`)
    .join(" ");

  const hasReal = prices.some((p) => p.realPrice !== undefined);
  const realPath = hasReal
    ? prices
        .filter((p) => p.realPrice !== undefined)
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"} ${toX(p.t)} ${toY(p.realPrice as number)}`,
        )
        .join(" ")
    : null;

  const baseY = toY(yMin);
  const areaPath = `${path} L ${toX(tEnd)} ${baseY} L ${toX(tStart)} ${baseY} Z`;

  const yTicks = ticksFor(yMin, yMax, 5).map((value) => ({
    value,
    y: toY(value),
  }));

  const xTickCount = 6;
  const xTicks = Array.from({ length: xTickCount }).map((_, i) => {
    const ratio = i / (xTickCount - 1);
    const x = PADDING.left + ratio * innerW;
    const t = tStart + ratio * tSpan;
    const d = new Date(t);
    const label = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    return { x, label };
  });

  return {
    path,
    realPath,
    areaPath,
    points: prices,
    yTicks,
    xTicks,
    lastPoint: prices[prices.length - 1],
    scale: { toX, toY },
  };
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function ticksFor(min: number, max: number, count: number): number[] {
  const step = (max - min) / count;
  return Array.from({ length: count }).map((_, i) => min + step * (i + 0.5));
}

interface NewsMarkerTooltipProps {
  marker: NewsMarker;
  chartW: number;
  chartH: number;
  now: number;
}

/** Headline tooltip — anchored just below the chart's top padding, centred on
 *  the marker line by default and flipped to a left-/right-anchored layout
 *  near the chart edges so the card stays inside the panel. */
function NewsMarkerTooltip({
  marker,
  chartW,
  chartH,
  now,
}: NewsMarkerTooltipProps) {
  const xPct = (marker.x / chartW) * 100;
  const yPct = ((PADDING.top + 14) / chartH) * 100;
  // Edge-flip: keep the tooltip inside the chart's horizontal bounds. Tuned
  // against an ~280px max-width and the typical panel size.
  const anchor: "left" | "center" | "right" =
    xPct < 18 ? "left" : xPct > 82 ? "right" : "center";
  const transform =
    anchor === "left"
      ? "translateX(0)"
      : anchor === "right"
        ? "translateX(-100%)"
        : "translateX(-50%)";
  const tone = marker.injected
    ? "var(--color-accent)"
    : "var(--color-fg-muted)";
  const ageMs = Math.max(0, now - marker.ts);
  return (
    <div
      className="pointer-events-none absolute z-10 border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] px-3 py-2 shadow-lg"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform,
        maxWidth: 280,
        minWidth: 180,
      }}
    >
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        <span
          aria-hidden
          className="inline-block h-2 w-[2px]"
          style={{ background: tone }}
        />
        <span className="truncate" style={{ color: tone }}>
          {marker.injected ? "Injected" : marker.source || "headline"}
        </span>
        <span className="ml-auto tabular-nums">{formatAgeMs(ageMs)}</span>
      </div>
      <p className="mt-1.5 text-[12px] font-semibold leading-snug text-[var(--color-fg)]">
        {marker.headline}
      </p>
    </div>
  );
}

function formatAgeMs(ms: number): string {
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
