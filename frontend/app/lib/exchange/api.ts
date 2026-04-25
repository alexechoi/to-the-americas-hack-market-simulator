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
  ExchangeSnapshot,
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
