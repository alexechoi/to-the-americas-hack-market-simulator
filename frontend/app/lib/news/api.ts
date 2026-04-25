/**
 * REST helpers for the backend news bus.
 *
 * Live stream lives in `useNews.ts` (SSE). These are for one-shots: hydrate the
 * recent buffer on mount, push a manually-injected headline.
 *
 * Mirrors `lib/exchange/api.ts` so we don't pull in Firebase Auth at module
 * load — the news endpoints are public.
 */

import type { InjectRequest, NewsHeadline } from "./types";

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

export async function injectHeadline(
  req: InjectRequest,
): Promise<NewsHeadline> {
  return fetchJson<NewsHeadline>("/news/inject", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function fetchRecentNews(n = 10): Promise<NewsHeadline[]> {
  return fetchJson<NewsHeadline[]>(`/news/recent?n=${n}`);
}
