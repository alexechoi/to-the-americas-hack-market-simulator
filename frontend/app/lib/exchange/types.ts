/**
 * Wire types for the backend exchange.
 *
 * Mirrors backend/runtime.py::_serialize_snapshot, ::_serialize_agent_decision,
 * ::_serialize_manual_order, and the FastAPI request models in exchange_api.py.
 * Keep in sync if either side changes.
 */

export interface LadderLevel {
  price: number;
  size: number;
}

/**
 * A single point in the rolling price history.
 *
 * Shared with the client-side price chart. Lived in lib/sim/types before the
 * frontend moved off the mock engine — kept here alongside ExchangeSnapshot
 * since that's where its samples actually originate now.
 */
export interface PricePoint {
  t: number;
  price: number;
  volume: number;
  realPrice?: number;
}

export interface Ladder {
  bids: LadderLevel[];
  asks: LadderLevel[];
}

export interface Trade {
  agent_id: string;
  qty: number; // signed: + buy, - sell
  vwap: number;
  levels: LadderLevel[];
}

export interface ExchangeSnapshot {
  tick_id: number;
  event_tick: number;
  fair: number;
  best_bid: number;
  best_ask: number;
  mid: number;
  ladder: Ladder;
  recent_trades: Trade[];
}

export interface Account {
  agent_id: string;
  inventory: number;
  cash: number;
  equity: number;
  n_fills: number;
}

export interface OrderRequest {
  agent_id: string;
  limit: number;
  qty: number;
}

/** Server-side outcome of a submitted FOK. Mirrors backend exchange_api._serialize_result. */
export type OrderResult =
  | {
      status: "filled";
      agent_id: string;
      qty: number; // signed
      vwap: number;
      levels: LadderLevel[];
    }
  | {
      status: "killed";
      agent_id: string;
      reason: "limit_not_crossed" | "insufficient_liquidity" | string;
    }
  | { status: "hold"; agent_id: string };

/**
 * Current ticker context — returned by GET /exchange/state and emitted on every
 * `reset` SSE event. ``fetched_at`` is null on cold-start fallback (Yahoo down)
 * and ISO-8601 once the runtime has been hydrated from a real Yahoo payload.
 *
 * Mirrors backend/runtime.py::ExchangeRuntime.state_payload.
 */
export interface ExchangeState {
  ticker: string;
  name: string;
  fair: number;
  fetched_at: string | null;
}

/**
 * One registered persona in the backend swarm — returned by GET /exchange/agents.
 *
 * Archetype strings mirror backend `TraderArchetype` (hft, market_maker, quant,
 * hedge_fund, pension_fund, tech_specialist, retail). The frontend uses them to
 * group dots into cohort tiers on the swarm panel and to colour order-log rows.
 */
export interface BackendAgent {
  agent_id: string;
  display_name: string;
  archetype: string;
}

/** What the LLM decided this turn. Mirrors backend `TraderAction`. */
export type OrderLogAction = "buy" | "sell" | "hold";

/**
 * One entry on the order-log SSE channel.
 *
 * Every swarm decision and every manual `/exchange/orders` submission lands
 * here. Agent entries carry persona + reasoning; manual entries carry neither
 * and are rendered by the UI with a `MANUAL` tag instead of an archetype.
 * Mirrors backend/runtime.py::_serialize_agent_decision and ::_serialize_manual_order.
 */
export interface OrderLogEntry {
  id: string;
  agentId: string;
  agentName: string | null;
  archetype: string | null;
  action: OrderLogAction;
  quantity: number;
  limitPrice: number;
  confidence: number | null;
  reasoning: string | null;
  ts: number;
  source: "agent" | "manual";
}
