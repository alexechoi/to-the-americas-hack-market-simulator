export type AgentArchetype =
  | "hft"
  | "macro"
  | "long_only"
  | "retail"
  | "contrarian"
  | "gamma"
  | "cta"
  | "treasury";

export interface AgentArchetypeMeta {
  id: AgentArchetype;
  label: string;
  shortLabel: string;
  cohort: "discretionary" | "mechanical";
  cooldownMs: number;
  defaultCount: number;
}

export interface Agent {
  id: string;
  archetype: AgentArchetype;
  name: string;
  conviction: number; // -1..1
  position: number; // signed shares
  cashPct: number; // 0..1
  lastActionAt: number;
  pnl: number;
}

export type Side = "buy" | "sell" | "hold";

export interface AgentDecision {
  id: string;
  agentId: string;
  archetype: AgentArchetype;
  agentName: string;
  side: Side;
  size: number;
  price: number;
  reasoning: string;
  ts: number;
}

export interface PricePoint {
  t: number;
  price: number;
  volume: number;
  realPrice?: number; // optional comparison line
}

export interface NewsHeadline {
  id: string;
  ts: number;
  source: string;
  title: string;
  sentiment: number; // -1..1
  injected?: boolean;
}

export interface ScenarioRow {
  id: string;
  headline: string;
  probability: number;
  expectedMove: number; // % move
  variance: number; // dispersion across agents
}

export interface SimSnapshot {
  ticker: string;
  price: number;
  openPrice: number;
  realPrice?: number;
  prices: PricePoint[];
  agents: Agent[];
  decisions: AgentDecision[];
  news: NewsHeadline[];
  scenarios: ScenarioRow[];
  paused: boolean;
  cycle: number;
  simulatedAt: number;
}
