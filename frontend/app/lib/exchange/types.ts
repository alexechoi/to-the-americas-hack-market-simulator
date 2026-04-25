/**
 * Wire types for the backend exchange.
 *
 * Mirrors backend/runtime.py::_serialize_snapshot and the FastAPI request models.
 * Keep in sync if either side changes.
 */

export interface LadderLevel {
  price: number;
  size: number;
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
