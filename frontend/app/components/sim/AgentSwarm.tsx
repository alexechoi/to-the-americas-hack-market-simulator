"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

/**
 * Each agent is a fixed point on a packed grid, clustered by reaction-speed
 * tier. When an agent decides something the matching dot pulses in its action
 * colour (BUY=up, SELL=down, HOLD=muted) and an orbit ring appears for ~800ms.
 * Layout is resize-aware so the swarm fills its container in tall, wide, or
 * square panels.
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

  const layout = useMemo(
    () => layoutAgents(agents, size.w, size.h),
    [agents, size.w, size.h],
  );

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

        // orbit ring on recent decision
        if (pulse > 0) {
          ctx.beginPath();
          ctx.strokeStyle = withAlpha(sideColor, pulse * 0.7);
          ctx.lineWidth = 1 * dpr;
          ctx.arc(cx, cy, r + 4 * dpr + (1 - pulse) * 5 * dpr, 0, Math.PI * 2);
          ctx.stroke();
        }

        // dot
        ctx.beginPath();
        ctx.fillStyle = pulse > 0 ? sideColor : baseColor;
        ctx.arc(cx, cy, r + pulse * 1.4 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [layout, lastByAgent]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={{ minHeight: height }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
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

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
