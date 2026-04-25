"use client";

import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type Archetype,
  ARCHETYPE_META,
  type ArchetypeMeta,
  archetypeMeta,
  TIERS,
} from "@/app/lib/exchange/archetypes";
import type { BackendAgent, OrderLogEntry } from "@/app/lib/exchange/types";

interface AgentSwarmProps {
  agents: BackendAgent[];
  /** Latest order-log entry per agent_id — pulses the matching dot. */
  lastByAgent: Map<string, OrderLogEntry>;
  height?: number;
}

/** Pixel radius (CSS) used for cursor hit-testing — slightly larger than the
 *  visible dot so dots are easy to grab without pixel-perfect aim. */
const HIT_RADIUS = 9;
/** Tooltip CSS width — height is measured from the rendered DOM and used to
 *  flip the tooltip vertically near the bottom edge. */
const TOOLTIP_W = 260;

/**
 * Each agent is a fixed point on a packed grid, clustered by reaction-speed
 * tier. When an agent decides something the matching dot adopts its action
 * colour (BUY=up, SELL=down, HOLD=base) and holds that tint until the agent's
 * next decision; the orbit ring + size bump pulse for ~800ms on top.
 * Layout is resize-aware so the swarm fills its container in tall, wide, or
 * square panels. Hovering a dot reveals a tooltip with the persona and its
 * latest decision.
 */
export function AgentSwarm({
  agents,
  lastByAgent,
  height = 240,
}: AgentSwarmProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dprRef = useRef(1);
  const [size, setSize] = useState({ w: 600, h: height });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const layout = useMemo(
    () => layoutAgents(agents, size.w, size.h),
    [agents, size.w, size.h],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, SwarmNode>();
    for (const n of layout.nodes) m.set(n.agent.agent_id, n);
    return m;
  }, [layout]);

  const hoveredNode = hoveredId ? (nodeById.get(hoveredId) ?? null) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dprRef.current = dpr;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = dprRef.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // cluster boxes
      ctx.font = `${10 * dpr}px var(--font-mono), ui-monospace, monospace`;
      ctx.textBaseline = "top";
      for (const cluster of layout.clusters) {
        ctx.strokeStyle = "#1f1f23";
        ctx.lineWidth = 1 * dpr;
        const x = cluster.x * dpr;
        const y = cluster.y * dpr;
        const cw = cluster.w * dpr;
        const ch = cluster.h * dpr;
        ctx.strokeRect(x, y, cw, ch);
        ctx.fillStyle = "#52525b";
        ctx.fillText(cluster.label.toUpperCase(), x + 8 * dpr, y + 6 * dpr);
        ctx.fillStyle = "#3f3f46";
        ctx.fillText(`${cluster.count}`, x + cw - 18 * dpr, y + 6 * dpr);
      }

      const wallNow = Date.now();
      for (const node of layout.nodes) {
        const cx = node.x * dpr;
        const cy = node.y * dpr;
        const r = 3.4 * dpr;
        const last = lastByAgent.get(node.agent.agent_id);
        const recent = last ? Math.max(0, 800 - (wallNow - last.ts)) : 0;
        const pulse = recent / 800;
        const baseColor = archetypeMeta(node.agent.archetype).color;
        const sideColor =
          last?.action === "buy"
            ? "#b6f569"
            : last?.action === "sell"
              ? "#ff6e6e"
              : baseColor;
        const isHovered = node.agent.agent_id === hoveredId;

        // orbit ring on recent decision
        if (pulse > 0) {
          ctx.beginPath();
          ctx.strokeStyle = withAlpha(sideColor, pulse * 0.7);
          ctx.lineWidth = 1 * dpr;
          ctx.arc(cx, cy, r + 4 * dpr + (1 - pulse) * 5 * dpr, 0, Math.PI * 2);
          ctx.stroke();
        }

        // hover halo — subtle, drawn under the dot so the colour stays clean
        if (isHovered) {
          ctx.beginPath();
          ctx.strokeStyle = withAlpha("#fafafa", 0.55);
          ctx.lineWidth = 1 * dpr;
          ctx.arc(cx, cy, r + 4 * dpr, 0, Math.PI * 2);
          ctx.stroke();
        }

        // dot — keep the BUY/SELL tint until this agent's next decision so a
        // glance still reads the most recent side; the size bump only lasts
        // for the 800ms pulse window above.
        ctx.beginPath();
        ctx.fillStyle = last ? sideColor : baseColor;
        ctx.arc(
          cx,
          cy,
          r + pulse * 1.4 * dpr + (isHovered ? 0.6 * dpr : 0),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [layout, lastByAgent, hoveredId]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const hit = nearestNode(layout.nodes, px, py, HIT_RADIUS);
    setHoveredId((prev) => {
      const next = hit ? hit.agent.agent_id : null;
      return prev === next ? prev : next;
    });
  };

  const handlePointerLeave = () => setHoveredId(null);

  const hoveredAgent = hoveredNode?.agent ?? null;
  const hoveredLast = hoveredAgent
    ? (lastByAgent.get(hoveredAgent.agent_id) ?? null)
    : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={{ minHeight: height }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      />
      {hoveredAgent && hoveredNode && (
        <AgentTooltip
          agent={hoveredAgent}
          last={hoveredLast}
          anchorX={hoveredNode.x}
          anchorY={hoveredNode.y}
          containerW={size.w}
          containerH={size.h}
        />
      )}
    </div>
  );
}

interface AgentTooltipProps {
  agent: BackendAgent;
  last: OrderLogEntry | null;
  anchorX: number;
  anchorY: number;
  containerW: number;
  containerH: number;
}

function AgentTooltip({
  agent,
  last,
  anchorX,
  anchorY,
  containerW,
  containerH,
}: AgentTooltipProps) {
  const meta = archetypeMeta(agent.archetype);
  const tierLabel = TIERS.find((t) => t.id === meta.tier)?.label ?? meta.tier;
  const tone =
    last?.action === "buy"
      ? "var(--color-up)"
      : last?.action === "sell"
        ? "var(--color-down)"
        : "var(--color-fg-muted)";
  const showQty = last && last.action !== "hold";

  // Measure the tooltip after render so we can flip it above/left of the dot
  // when there isn't room below/right. Persona content (especially backstory)
  // varies in height, so a fixed-height clamp would either crop or float.
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    setPos(clampTooltip(anchorX, anchorY, containerW, containerH, h));
  }, [agent.agent_id, last?.id, anchorX, anchorY, containerW, containerH]);

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none absolute z-10 border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] px-3 py-2.5 shadow-lg"
      style={{
        left: pos?.x ?? anchorX,
        top: pos?.y ?? anchorY,
        width: TOOLTIP_W,
        // Hide the first paint until we've measured + clamped, so the tooltip
        // never appears mid-flip near a viewport edge.
        opacity: pos ? 1 : 0,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-[var(--color-fg)]">
          {agent.display_name}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
          {meta.shortLabel}
        </span>
      </div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
        {tierLabel}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <PersonaTag>{formatRisk(agent.risk_tolerance)}</PersonaTag>
        <PersonaTag>{formatHorizon(agent.time_horizon)}</PersonaTag>
        <PersonaTag>{formatCadence(agent.tick_period_s)}</PersonaTag>
        <PersonaTag>max {agent.max_order_size}</PersonaTag>
      </div>

      {agent.backstory && (
        <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-[var(--color-fg-muted)]">
          {agent.backstory}
        </p>
      )}

      <div className="mt-2 border-t border-[var(--color-line)] pt-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
          Last decision
        </div>
        {last ? (
          <>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="font-mono text-[10px] tabular-nums tracking-[0.16em]"
                style={{ color: tone }}
              >
                {last.action.toUpperCase()}
              </span>
              {showQty && (
                <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg)]">
                  {last.quantity.toLocaleString()}
                </span>
              )}
              <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-faint)]">
                @ {last.limitPrice.toFixed(2)}
              </span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
                {formatAgo(last.ts)}
              </span>
            </div>
            {last.reasoning && (
              <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-[var(--color-fg-muted)]">
                {last.reasoning}
              </p>
            )}
          </>
        ) : (
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
            No decisions yet
          </span>
        )}
      </div>
    </div>
  );
}

function PersonaTag({ children }: { children: ReactNode }) {
  return (
    <span className="border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
      {children}
    </span>
  );
}

interface SwarmNode {
  agent: BackendAgent;
  x: number;
  y: number;
}

interface SwarmCluster {
  label: string;
  tier: ArchetypeMeta["tier"];
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
}

function tierFor(arch: string): ArchetypeMeta["tier"] {
  if (arch in ARCHETYPE_META) {
    return ARCHETYPE_META[arch as Archetype].tier;
  }
  return "discretionary";
}

function layoutAgents(
  agents: BackendAgent[],
  containerW: number,
  containerH: number,
): {
  nodes: SwarmNode[];
  clusters: SwarmCluster[];
} {
  const gutter = 12;
  // In tall/narrow panels stack tiers as rows; in wide panels split as columns.
  const stackVertical = containerH / Math.max(1, containerW) > 0.85;

  const clusters: SwarmCluster[] = [];
  const nodes: SwarmNode[] = [];

  if (stackVertical) {
    const rowH = (containerH - gutter * (TIERS.length + 1)) / TIERS.length;
    TIERS.forEach((tier, ti) => {
      const tierAgents = agents.filter((a) => tierFor(a.archetype) === tier.id);
      const x = gutter;
      const y = gutter + ti * (rowH + gutter);
      const w = containerW - gutter * 2;
      const h = rowH;
      clusters.push({
        label: tier.label,
        tier: tier.id,
        x,
        y,
        w,
        h,
        count: tierAgents.length,
      });
      packIntoCluster(tierAgents, nodes, x, y, w, h);
    });
  } else {
    const colW = (containerW - gutter * (TIERS.length + 1)) / TIERS.length;
    TIERS.forEach((tier, ti) => {
      const tierAgents = agents.filter((a) => tierFor(a.archetype) === tier.id);
      const x = gutter + ti * (colW + gutter);
      const y = gutter;
      const w = colW;
      const h = containerH - gutter * 2;
      clusters.push({
        label: tier.label,
        tier: tier.id,
        x,
        y,
        w,
        h,
        count: tierAgents.length,
      });
      packIntoCluster(tierAgents, nodes, x, y, w, h);
    });
  }

  return { nodes, clusters };
}

function packIntoCluster(
  tierAgents: BackendAgent[],
  nodes: SwarmNode[],
  cx: number,
  cy: number,
  cw: number,
  ch: number,
) {
  const padX = 14;
  const padTop = 28;
  const padBottom = 12;
  const innerX = cx + padX;
  const innerY = cy + padTop;
  const innerW = Math.max(1, cw - padX * 2);
  const innerH = Math.max(1, ch - padTop - padBottom);
  if (tierAgents.length === 0) return;
  const cols = Math.max(
    1,
    Math.round(Math.sqrt(tierAgents.length * (innerW / innerH))),
  );
  const rows = Math.ceil(tierAgents.length / cols);
  const cellW = innerW / cols;
  const cellH = innerH / rows;
  tierAgents.forEach((agent, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const offset = r % 2 === 0 ? 0 : cellW / 2;
    const x = innerX + c * cellW + cellW / 2 + offset;
    const y = innerY + r * cellH + cellH / 2;
    nodes.push({ agent, x, y });
  });
}

/** Closest node within `maxDist` CSS pixels of (px, py), or null. */
function nearestNode(
  nodes: SwarmNode[],
  px: number,
  py: number,
  maxDist: number,
): SwarmNode | null {
  let best: SwarmNode | null = null;
  let bestDistSq = maxDist * maxDist;
  for (const n of nodes) {
    const dx = n.x - px;
    const dy = n.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestDistSq) {
      best = n;
      bestDistSq = d2;
    }
  }
  return best;
}

/** Place the tooltip near the dot, flipping sides so it stays inside the panel.
 *  Height is the measured DOM height — content is variable so the caller passes
 *  it in after layout instead of assuming a fixed value. */
function clampTooltip(
  nodeX: number,
  nodeY: number,
  containerW: number,
  containerH: number,
  tooltipH: number,
): { x: number; y: number } {
  const margin = 6;
  const offset = 12;
  const fitsRight = nodeX + offset + TOOLTIP_W + margin <= containerW;
  const x = fitsRight
    ? nodeX + offset
    : Math.max(margin, nodeX - offset - TOOLTIP_W);
  const fitsBelow = nodeY + offset + tooltipH + margin <= containerH;
  const y = fitsBelow
    ? nodeY + offset
    : Math.max(margin, nodeY - offset - tooltipH);
  return { x, y };
}

function formatAgo(ts: number): string {
  const ms = Math.max(0, Date.now() - ts);
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatRisk(risk: string): string {
  // Backend ships lowercase enums; chip labels are uppercase elsewhere in the UI.
  return risk.replace(/_/g, " ");
}

function formatHorizon(horizon: string): string {
  return horizon.replace(/_/g, " ");
}

/** Render a persona's nominal cadence as a human-friendly chip ("~5s", "~2m"). */
function formatCadence(seconds: number): string {
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const m = seconds / 60;
  // One decimal under 10 minutes (e.g. 2.5m), whole minutes after.
  return m < 10 ? `~${m.toFixed(1)}m` : `~${Math.round(m)}m`;
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
