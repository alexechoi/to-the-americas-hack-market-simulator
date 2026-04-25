/**
 * Display metadata for the four backend trader archetypes.
 *
 * The archetype string itself is the source of truth (mirrors backend
 * `TraderArchetype`). This module only adds presentation-layer details:
 * a short label for the row chip, a base colour for the swarm dot, and a
 * cohort tier so the swarm panel can group dots by reaction speed.
 */

export type Archetype = "hft" | "hedge_fund" | "pension_fund" | "retail";

export interface ArchetypeMeta {
  /** Short uppercase chip rendered in the order log. */
  shortLabel: string;
  /** Resting dot colour on the swarm canvas (overridden by side colour on pulse). */
  color: string;
  /** Speed cohort the agent belongs to — drives the swarm tier layout. */
  tier: "algo" | "discretionary" | "slow";
}

export const ARCHETYPE_META: Record<Archetype, ArchetypeMeta> = {
  hft: { shortLabel: "HFT", color: "#71717a", tier: "algo" },
  hedge_fund: { shortLabel: "HF", color: "#9ca3af", tier: "discretionary" },
  pension_fund: { shortLabel: "PENSION", color: "#737373", tier: "slow" },
  retail: { shortLabel: "RETAIL", color: "#52525b", tier: "slow" },
};

/**
 * Look up archetype metadata. Returns a neutral default if the backend ever
 * adds a new archetype before the frontend learns about it — keeps the panel
 * rendering instead of crashing on an unknown key.
 */
export function archetypeMeta(arch: string | null | undefined): ArchetypeMeta {
  if (arch && arch in ARCHETYPE_META) {
    return ARCHETYPE_META[arch as Archetype];
  }
  return {
    shortLabel: arch?.toUpperCase() ?? "?",
    color: "#52525b",
    tier: "discretionary",
  };
}

/** Tier ordering + display label used by the swarm panel layout. */
export const TIERS: { id: ArchetypeMeta["tier"]; label: string }[] = [
  { id: "algo", label: "Algo · sub-second" },
  { id: "discretionary", label: "Discretionary · minutes" },
  { id: "slow", label: "Slow · long-term" },
];
