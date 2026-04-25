/**
 * REST helpers for the exchange backend.
 *
 * The live tape uses SSE (see useExchange.ts). These are for one-shots:
 * submit, account fetch, debug snapshot.
 *
 * We do NOT route through `lib/api.ts` because that pulls in Firebase Auth
 * at module-load time, which would couple the exchange UI to Firebase init.
 * The backend exchange endpoints are public (no auth required).
 */

import type {
  Account,
  BackendAgent,
  ExchangeSnapshot,
  ExchangeState,
  OrderRequest,
  OrderResult,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .catch(() => ({ detail: `${res.status} ${res.statusText}` }));
    throw new Error(detail.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function submitOrder(req: OrderRequest): Promise<OrderResult> {
  return fetchJson<OrderResult>("/exchange/orders", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function fetchAccount(agentId: string): Promise<Account> {
  return fetchJson<Account>(`/exchange/account/${encodeURIComponent(agentId)}`);
}

export async function fetchSnapshot(): Promise<ExchangeSnapshot> {
  return fetchJson<ExchangeSnapshot>("/exchange/snapshot");
}

/**
 * One-shot fetch of the registered swarm roster. Used by the Agent Swarm panel
 * to lay out one dot per persona, grouped by archetype. The roster is static
 * for the lifetime of the backend process; the frontend refetches only on
 * a remount (e.g. after a /spawn).
 */
export async function listAgents(): Promise<BackendAgent[]> {
  return fetchJson<BackendAgent[]>("/exchange/agents");
}

/**
 * Current ticker / display name / fair price the backend is simulating around.
 *
 * Mostly used as a one-shot fallback on mount; the same shape also flows live
 * over the SSE `reset` channel, so callers that already consume the SSE stream
 * usually don't need this.
 */
export async function fetchExchangeState(): Promise<ExchangeState> {
  return fetchJson<ExchangeState>("/exchange/state");
}

/**
 * Re-bootstrap the simulation around a new ticker.
 *
 * Triggers a full backend reset: fresh Exchange seeded at the live Yahoo spot
 * price, fresh news bus pre-loaded with a few recent Yahoo headlines, swarm
 * accounts re-registered with their configured initial cash. Live SSE
 * subscribers receive a `reset` envelope on success and should clear their
 * chart buffers in response.
 *
 * Resolves with the new {@link ExchangeState}. Throws on 4xx — typically
 * because the ticker was rejected by Yahoo (unknown symbol, no usable price,
 * or upstream temporary failure).
 */
export async function spawnExchange(ticker: string): Promise<ExchangeState> {
  return fetchJson<ExchangeState>("/exchange/spawn", {
    method: "POST",
    body: JSON.stringify({ ticker }),
  });
}
