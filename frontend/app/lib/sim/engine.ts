import { ARCHETYPE_LIST, ARCHETYPES } from "./archetypes";
import type {
  Agent,
  AgentArchetype,
  AgentDecision,
  NewsHeadline,
  PricePoint,
  ScenarioRow,
  SimSnapshot,
} from "./types";

/**
 * Deterministic-ish market simulator used for the Animal Spirits demo.
 *
 * Real engine lives in Python. This is a faithful client-side stub so the
 * frontend works standalone — same shapes, same cadence.
 */

const RNG_SEED = 0x9e3779b9;

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const FIRST_NAMES = [
  "Avery",
  "Sloan",
  "Cam",
  "Reese",
  "Kit",
  "Noa",
  "Jules",
  "Theo",
  "Sky",
  "Quinn",
  "Lior",
  "Mira",
  "Ren",
  "Indie",
  "Vega",
  "Soren",
];
const FIRMS = [
  "Citadel",
  "Two Sigma",
  "Bridgewater",
  "Renaissance",
  "Millennium",
  "DE Shaw",
  "AQR",
  "Point72",
  "Brevan",
  "Tudor",
];

const NEWS_BANK: Pick<NewsHeadline, "source" | "title" | "sentiment">[] = [
  {
    source: "Bloomberg",
    title: "NVDA earnings top expectations, data-center revenue +59%",
    sentiment: 0.62,
  },
  {
    source: "Reuters",
    title: "US Commerce expands chip-export curbs to additional fabs",
    sentiment: -0.55,
  },
  {
    source: "FT",
    title: "Treasury yields slip after softer-than-expected CPI print",
    sentiment: 0.28,
  },
  {
    source: "WSJ",
    title: "Fed minutes signal patience; dot plot unchanged",
    sentiment: 0.05,
  },
  {
    source: "Bloomberg",
    title: "NVDA guides Q3 above consensus, supply ramp on track",
    sentiment: 0.48,
  },
  {
    source: "Reuters",
    title: "Sovereign fund initiates 2.4% NVDA stake, filing shows",
    sentiment: 0.34,
  },
  {
    source: "FT",
    title: "Hyperscaler delays $4B order, sources say",
    sentiment: -0.42,
  },
];

const REASONING_BY_ARCHETYPE: Record<AgentArchetype, string[]> = {
  hft: [
    "Mid-spread imbalance — taking offer for 200",
    "VWAP slipping above MA50, fading",
    "Latency hit 11ms; lifting top of book",
    "Quote stuffing detected adjacent venue",
  ],
  gamma: [
    "Net delta drift exceeds threshold; rebalancing",
    "Dealer book leaning short gamma — buying spot",
    "Vega hedge unwind, trimming position",
  ],
  cta: [
    "20D x 50D crossover triggered long signal",
    "Trend strength above 1.4σ, pyramiding",
    "Vol-of-vol spike, scaling in slowly",
  ],
  macro: [
    "Higher real yields → de-rate growth multiple",
    "Stagflation tail thicker; trimming risk",
    "Convexity favors carry over duration here",
  ],
  long_only: [
    "Thesis intact, adding on weakness",
    "Quality factor outperforming, holding",
    "Position sized to mandate, no change",
  ],
  contrarian: [
    "Crowd is leaning the same way — fading",
    "Sentiment indicator at 92nd percentile",
    "Initiating short, target -3.4%",
  ],
  treasury: [
    "Refinancing window narrowing; pre-fund",
    "Hedging FX exposure on print",
    "No action — corporate window closed",
  ],
  retail: [
    "Saw it on tape, buying small",
    "Diamond hands, holding through chop",
    "Got stopped out at the round number",
    "Rotating from QQQ into single name",
  ],
};

export function buildInitialAgents(seed = RNG_SEED): Agent[] {
  const rand = mulberry32(seed);
  const agents: Agent[] = [];
  for (const a of ARCHETYPE_LIST) {
    for (let i = 0; i < a.defaultCount; i++) {
      const firm = pick(rand, FIRMS);
      const first = pick(rand, FIRST_NAMES);
      agents.push({
        id: `${a.id}-${i}`,
        archetype: a.id,
        name:
          a.id === "retail"
            ? `r/${first.toLowerCase()}${Math.floor(rand() * 99)}`
            : `${first} · ${firm}`,
        conviction: rand() * 2 - 1,
        position: 0,
        cashPct: 0.5 + rand() * 0.5,
        lastActionAt: 0,
        pnl: 0,
      });
    }
  }
  return agents;
}

export interface EngineOptions {
  ticker: string;
  startPrice: number;
  realPrices?: number[]; // optional comparison series, sampled at the same cadence
  tickMs: number;
  seed?: number;
}

export class MarketEngine {
  private rand: () => number;
  private opts: EngineOptions;
  private snapshot: SimSnapshot;
  private listeners = new Set<(s: SimSnapshot) => void>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private newsTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.rand = mulberry32(opts.seed ?? RNG_SEED);
    const agents = buildInitialAgents(opts.seed);
    const now = Date.now();
    this.startedAt = now;
    const initialPrice: PricePoint = {
      t: now,
      price: opts.startPrice,
      volume: 0,
      realPrice: opts.realPrices?.[0],
    };
    this.snapshot = {
      ticker: opts.ticker,
      price: opts.startPrice,
      openPrice: opts.startPrice,
      realPrice: opts.realPrices?.[0],
      prices: [initialPrice],
      agents,
      decisions: [],
      news: [],
      scenarios: this.buildScenarios(opts.startPrice),
      paused: false,
      cycle: 0,
      simulatedAt: now,
    };
  }

  subscribe(fn: (s: SimSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn(this.snapshot);
  }

  start() {
    if (this.interval) return;
    this.scheduleNews();
    this.interval = setInterval(() => this.tick(), this.opts.tickMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.newsTimer) clearTimeout(this.newsTimer);
    this.newsTimer = null;
  }

  setPaused(paused: boolean) {
    this.snapshot = { ...this.snapshot, paused };
    this.emit();
  }

  injectHeadline(title: string, sentiment: number, source = "user") {
    const headline: NewsHeadline = {
      id: `n-${Date.now()}`,
      ts: Date.now(),
      source,
      title,
      sentiment,
      injected: true,
    };
    const news = [headline, ...this.snapshot.news].slice(0, 40);
    this.snapshot = { ...this.snapshot, news };
    // Send a shock through the agent population on next tick.
    this.shockSentiment = sentiment;
    this.shockExpiry = Date.now() + 6500;
    this.emit();
  }

  private shockSentiment = 0;
  private shockExpiry = 0;

  private scheduleNews() {
    const delay = 5500 + this.rand() * 7500;
    this.newsTimer = setTimeout(() => {
      const item = pick(this.rand, NEWS_BANK);
      const headline: NewsHeadline = {
        id: `n-${Date.now()}`,
        ts: Date.now(),
        source: item.source,
        title: item.title,
        sentiment: item.sentiment,
      };
      this.snapshot = {
        ...this.snapshot,
        news: [headline, ...this.snapshot.news].slice(0, 40),
      };
      this.shockSentiment = item.sentiment * 0.7;
      this.shockExpiry = Date.now() + 5000;
      this.emit();
      this.scheduleNews();
    }, delay);
  }

  private tick() {
    if (this.snapshot.paused) return;
    const now = Date.now();
    const elapsed = now - this.startedAt;

    const sentiment = now < this.shockExpiry ? this.shockSentiment : 0;

    // Build decisions from agents whose cooldown elapsed
    const newDecisions: AgentDecision[] = [];
    let netFlow = 0;
    const updatedAgents = this.snapshot.agents.map((agent) => {
      const meta = ARCHETYPES[agent.archetype];
      if (now - agent.lastActionAt < meta.cooldownMs) return agent;
      // probability of acting depends on shock + conviction
      const trigger =
        Math.abs(sentiment) * 0.7 + Math.abs(agent.conviction) * 0.15 + 0.05;
      if (this.rand() > trigger && Math.abs(sentiment) < 0.25) return agent;

      const sideBias = sentiment + agent.conviction * 0.4;
      const side = sideBias > 0.05 ? "buy" : sideBias < -0.05 ? "sell" : "hold";
      const sizeBase =
        agent.archetype === "hft"
          ? 50 + this.rand() * 150
          : agent.archetype === "retail"
            ? 1 + Math.floor(this.rand() * 6)
            : 80 + this.rand() * 600;
      const size = side === "hold" ? 0 : Math.round(sizeBase);
      const price = this.snapshot.price;

      if (side === "buy") netFlow += size;
      if (side === "sell") netFlow -= size;

      newDecisions.push({
        id: `d-${now}-${agent.id}`,
        agentId: agent.id,
        archetype: agent.archetype,
        agentName: agent.name,
        side,
        size,
        price,
        ts: now,
        reasoning: pick(this.rand, REASONING_BY_ARCHETYPE[agent.archetype]),
      });

      return {
        ...agent,
        lastActionAt: now,
        position:
          agent.position +
          (side === "buy" ? size : side === "sell" ? -size : 0),
        conviction: clamp(
          agent.conviction + sentiment * 0.05 + (this.rand() - 0.5) * 0.02,
          -1,
          1,
        ),
      };
    });

    // Square-root impact
    const impact =
      Math.sign(netFlow) *
      Math.sqrt(Math.abs(netFlow) / 2500) *
      this.snapshot.price *
      0.0014;
    const drift = (this.rand() - 0.5) * this.snapshot.price * 0.0006;
    const newPrice = Math.max(0.01, this.snapshot.price + impact + drift);

    const realPrice = this.opts.realPrices
      ? this.opts.realPrices[
          Math.min(
            this.opts.realPrices.length - 1,
            Math.floor(elapsed / this.opts.tickMs),
          )
        ]
      : undefined;

    const newPoint: PricePoint = {
      t: now,
      price: round2(newPrice),
      volume: Math.abs(netFlow),
      realPrice,
    };

    const prices = [...this.snapshot.prices, newPoint].slice(-180);
    const decisions = [...newDecisions, ...this.snapshot.decisions].slice(
      0,
      120,
    );

    this.snapshot = {
      ...this.snapshot,
      price: newPoint.price,
      realPrice,
      prices,
      decisions,
      agents: updatedAgents,
      cycle: this.snapshot.cycle + 1,
      simulatedAt: now,
      scenarios: this.snapshot.scenarios.map((s) => ({
        ...s,
        // gentle dispersion drift to keep the table alive
        variance: clamp(s.variance + (this.rand() - 0.5) * 0.02, 0.05, 1),
      })),
    };
    this.emit();
  }

  private buildScenarios(price: number): ScenarioRow[] {
    return [
      {
        id: "s1",
        headline: "Export curbs expanded to additional fabs",
        probability: 0.18,
        expectedMove: -4.6,
        variance: 0.42,
      },
      {
        id: "s2",
        headline: "Hyperscaler signs $10B multi-year supply deal",
        probability: 0.22,
        expectedMove: 5.8,
        variance: 0.31,
      },
      {
        id: "s3",
        headline: "Q3 guide in line, no commentary on China",
        probability: 0.34,
        expectedMove: 0.4,
        variance: 0.18,
      },
      {
        id: "s4",
        headline: "Activist letter targeting capital allocation",
        probability: 0.08,
        expectedMove: 2.1,
        variance: 0.55,
      },
      {
        id: "s5",
        headline: "FOMC surprises hawkish; long-duration de-rates",
        probability: 0.18,
        expectedMove: -2.8,
        variance: 0.27,
      },
    ].map((s) => ({
      ...s,
      headline: s.headline,
      // make expectedMove relative to current price for display
      expectedMove: s.expectedMove + (price - 142) * 0,
    }));
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
