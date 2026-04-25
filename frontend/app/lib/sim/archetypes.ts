import type { AgentArchetype, AgentArchetypeMeta } from "./types";

export const ARCHETYPES: Record<AgentArchetype, AgentArchetypeMeta> = {
  hft: {
    id: "hft",
    label: "HFT / latency arb",
    shortLabel: "HFT",
    cohort: "mechanical",
    cooldownMs: 120,
    defaultCount: 18,
  },
  gamma: {
    id: "gamma",
    label: "Dealer gamma hedger",
    shortLabel: "Gamma",
    cohort: "mechanical",
    cooldownMs: 600,
    defaultCount: 6,
  },
  cta: {
    id: "cta",
    label: "CTA / momentum",
    shortLabel: "CTA",
    cohort: "mechanical",
    cooldownMs: 1500,
    defaultCount: 8,
  },
  macro: {
    id: "macro",
    label: "Hedge fund macro PM",
    shortLabel: "Macro",
    cohort: "discretionary",
    cooldownMs: 2200,
    defaultCount: 5,
  },
  long_only: {
    id: "long_only",
    label: "Long-only PM",
    shortLabel: "Long-only",
    cohort: "discretionary",
    cooldownMs: 3500,
    defaultCount: 6,
  },
  contrarian: {
    id: "contrarian",
    label: "Short / contrarian",
    shortLabel: "Contrarian",
    cohort: "discretionary",
    cooldownMs: 2800,
    defaultCount: 4,
  },
  treasury: {
    id: "treasury",
    label: "Corporate treasury",
    shortLabel: "Treasury",
    cohort: "discretionary",
    cooldownMs: 6000,
    defaultCount: 3,
  },
  retail: {
    id: "retail",
    label: "Retail",
    shortLabel: "Retail",
    cohort: "discretionary",
    cooldownMs: 4500,
    defaultCount: 30,
  },
};

export const ARCHETYPE_LIST = Object.values(ARCHETYPES);
