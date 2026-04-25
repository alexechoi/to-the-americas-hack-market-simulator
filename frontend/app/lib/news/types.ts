/**
 * Wire types for the backend news bus.
 *
 * Mirrors backend/news/types.py::NewsHeadline. Time on the wire is the integer
 * `tick_id` — the exchange's authoritative clock — not wall-clock seconds.
 */

export interface NewsHeadline {
  headline_id: string;
  /** Exchange tick at publish time. Anchor for pct_change_since math. */
  tick_id: number;
  /** Wall-clock unix seconds at publish time. Display only. */
  ts: number;
  source: string;
  headline: string;
  body?: string | null;
}

export interface InjectRequest {
  source?: string;
  headline: string;
  body?: string | null;
}
