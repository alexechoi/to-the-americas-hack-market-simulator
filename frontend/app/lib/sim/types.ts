/**
 * Legacy mock types — left in place for the orphan components in
 * `app/components/sim/` (ScenarioTable, OrderTape, NewsFeed, CohortLegend)
 * that the live `/sim` page no longer imports.
 *
 * The live exchange path uses `app/lib/exchange/types.ts`. Do not add new
 * shapes here unless you're reviving one of the orphan components.
 *
 * `PricePoint` moved to `app/lib/exchange/types.ts` since it now describes a
 * server-driven sample, not a mock-engine sample.
 */

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
