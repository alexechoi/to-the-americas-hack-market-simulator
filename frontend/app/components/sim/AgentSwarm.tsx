"use client";

import { useEffect, useMemo, useRef } from "react";

import { ARCHETYPES } from "@/app/lib/sim/archetypes";
import type { Agent, AgentArchetype, AgentDecision } from "@/app/lib/sim/types";

interface AgentSwarmProps {
  agents: Agent[];
  decisions: AgentDecision[];
  height?: number;
}

/**
 * Each agent is a fixed point on a force-arranged honeycomb. When an agent
 * makes a decision, the dot pulses in its side colour and a thin orbit ring
 * appears for ~700ms. Cohorts are arranged into clusters left-to-right by
 * reaction speed, so faster agents cluster on the left.
 */
export function AgentSwarm({
  agents,
  decisions,
  height = 320,
}: AgentSwarmProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dprRef = useRef(1);

  const layout = useMemo(() => layoutAgents(agents), [agents]);

  // map of agentId → most recent decision timestamp (for pulse)
  const lastByAgent = useMemo(() => {
    const m = new Map<string, { ts: number; side: AgentDecision["side"] }>();
    for (const d of decisions) {
      const prev = m.get(d.agentId);
      if (!prev || d.ts > prev.ts) m.set(d.agentId, { ts: d.ts, side: d.side });
    }
    return m;
  }, [decisions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dprRef.current = dpr;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
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
        const last = lastByAgent.get(node.agent.id);
        const recent = last ? Math.max(0, 800 - (wallNow - last.ts)) : 0;
        const pulse = recent / 800;
        const baseColor = colourFor(node.agent.archetype);
        const sideColor =
          last?.side === "buy"
            ? "#b6f569"
            : last?.side === "sell"
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
  agent: Agent;
  x: number;
  y: number;
}

interface SwarmCluster {
  label: string;
  archetype: AgentArchetype;
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
}

function layoutAgents(agents: Agent[]): {
  nodes: SwarmNode[];
  clusters: SwarmCluster[];
} {
  // Cohort grouping by latency tier
  const tiers: { label: string; archetypes: AgentArchetype[] }[] = [
    { label: "Algo · sub-second", archetypes: ["hft", "gamma"] },
    { label: "Mechanical · seconds", archetypes: ["cta"] },
    {
      label: "Discretionary · minutes",
      archetypes: ["macro", "long_only", "contrarian", "treasury"],
    },
    { label: "Retail · slow", archetypes: ["retail"] },
  ];

  const containerW = 600;
  const containerH = 320;
  const gutter = 14;
  const colCount = tiers.length;
  const colW = (containerW - gutter * (colCount + 1)) / colCount;

  const clusters: SwarmCluster[] = [];
  const nodes: SwarmNode[] = [];

  tiers.forEach((tier, ti) => {
    const tierAgents = agents.filter((a) =>
      tier.archetypes.includes(a.archetype),
    );
    const colX = gutter + ti * (colW + gutter);
    const colY = 8;
    const colH = containerH - 16;
    clusters.push({
      label: tier.label,
      archetype: tier.archetypes[0],
      x: colX,
      y: colY,
      w: colW,
      h: colH,
      count: tierAgents.length,
    });

    // Honeycomb pack inside the column
    const innerX = colX + 14;
    const innerY = colY + 28;
    const innerW = colW - 28;
    const innerH = colH - 36;
    const cols = Math.max(
      3,
      Math.floor(Math.sqrt(tierAgents.length * (innerW / innerH))),
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
  });

  return { nodes, clusters };
}

function colourFor(arch: AgentArchetype): string {
  const map: Record<AgentArchetype, string> = {
    hft: "#71717a",
    gamma: "#a1a1aa",
    cta: "#737373",
    macro: "#9ca3af",
    long_only: "#a3a3a3",
    contrarian: "#a8a29e",
    treasury: "#737373",
    retail: "#52525b",
  };
  // Touch ARCHETYPES so tree-shaker keeps the import (and to validate keys)
  void ARCHETYPES;
  return map[arch];
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
