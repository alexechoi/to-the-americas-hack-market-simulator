"""Singleton agent swarm runtime: one asyncio task per registered persona.

Each registered ``TraderPersona`` gets its own background task that loops at the
persona's ``tick_period_s`` (with ±20% jitter so HFTs don't align at integer
seconds). Per iteration the task:

    1. Snapshots the world for this persona (``build_trader_context``).
    2. Calls the cached pydantic-ai trader Agent (``build_trader_agent``).
    3. Broadcasts the decision to the order-log SSE stream via
       ``ExchangeRuntime.record_decision`` — every BUY, SELL, **and HOLD** is
       visible in the UI, with persona + reasoning attached.
    4. If the decision is non-hold, queues the order via ``Exchange.submit`` so
       concurrent agents are shuffled fairly inside the same event tick (never
       wall-clock raced). Killed orders still appear in the order log as their
       original decision; the eventual fill flows through the snapshot's
       ``recent_trades`` feed for the order-book panel.

A single bad turn must not kill the loop — every iteration is wrapped in
try/except so a parse failure or transient gateway error is logged and the
agent keeps ticking.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
from dataclasses import dataclass

import logfire

from agents import (
    TraderDecision,
    TraderPersona,
    build_trader_agent,
    build_trader_context,
    fresh_window_s,
)
from agents.memory import memory
from exchange.types import Order
from runtime import runtime as exchange_runtime

logger = logging.getLogger(__name__)

# Jitter as a fraction of tick_period_s. ±20% breaks lock-step alignment between
# agents with the same nominal cadence without materially shifting average rate.
JITTER_FRAC = 0.2

# Floor on sleep between turns to keep a runaway-fast persona from starving the loop.
MIN_SLEEP_S = 0.05

# Standing prompt for every turn — persona/market/account/news flow in via deps.
TURN_PROMPT = "Take your turn."


def _read_tick_multiplier() -> float:
    """Global scale applied to every persona's tick_period_s.

    Set ``AGENT_TICK_MULTIPLIER=10`` to slow the whole swarm 10× during local
    testing without touching the roster. Invalid / non-positive values fall back
    to 1.0 with a warning rather than failing startup.
    """
    raw = os.getenv("AGENT_TICK_MULTIPLIER", "1.0")
    try:
        v = float(raw)
        if v <= 0:
            raise ValueError("must be positive")
        return v
    except ValueError:
        logger.warning("Invalid AGENT_TICK_MULTIPLIER=%r — falling back to 1.0", raw)
        return 1.0


TICK_MULTIPLIER = _read_tick_multiplier()


@dataclass
class _ManagedAgent:
    persona: TraderPersona
    task: asyncio.Task[None] | None = None


def _next_sleep(tick_period_s: float) -> float:
    scaled = tick_period_s * TICK_MULTIPLIER
    jitter = random.uniform(-JITTER_FRAC, JITTER_FRAC) * scaled
    return max(MIN_SLEEP_S, scaled + jitter)


class AgentSwarmRuntime:
    """Owns the per-agent task fleet. Lifecycle mirrors ``ExchangeRuntime``."""

    def __init__(self) -> None:
        self._agents: dict[str, _ManagedAgent] = {}
        self._started = False

    # ---- registration ----

    def register(self, persona: TraderPersona) -> None:
        """Register a persona. Idempotent on agent_id.

        Safe to call before or after ``start()``: if the swarm is already
        running, this immediately spawns the persona's loop task.
        """
        existing = self._agents.get(persona.agent_id)
        if existing is not None:
            # Already registered — leave the running task alone.
            return
        managed = _ManagedAgent(persona=persona)
        self._agents[persona.agent_id] = managed
        # Pre-register with the exchange so the first observe() doesn't race
        # the first submit on account creation.
        exchange_runtime.exchange.register(
            persona.agent_id, initial_cash=persona.initial_cash
        )
        if self._started:
            self._spawn(managed)

    def list_personas(self) -> list[TraderPersona]:
        return [m.persona for m in self._agents.values()]

    # ---- lifecycle ----

    def start(self) -> None:
        if self._started:
            return
        self._started = True
        for managed in self._agents.values():
            self._spawn(managed)
        logger.info(
            "Agent swarm started with %d agents (tick_multiplier=%.2f)",
            len(self._agents),
            TICK_MULTIPLIER,
        )

    async def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        tasks = [m.task for m in self._agents.values() if m.task is not None]
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        for managed in self._agents.values():
            managed.task = None
        logger.info("Agent swarm stopped")

    # ---- internals ----

    def _spawn(self, managed: _ManagedAgent) -> None:
        if managed.task is not None and not managed.task.done():
            return
        managed.task = asyncio.create_task(
            self._run_agent(managed.persona),
            name=f"agent-loop:{managed.persona.agent_id}",
        )
        logger.info(
            "Agent loop started: %s (%s, tick=%.2fs)",
            managed.persona.agent_id,
            managed.persona.archetype.value,
            managed.persona.tick_period_s,
        )

    async def _run_agent(self, persona: TraderPersona) -> None:
        agent = build_trader_agent()
        try:
            while True:
                await asyncio.sleep(_next_sleep(persona.tick_period_s))
                try:
                    await self._one_turn(agent, persona)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    # One bad turn must not kill the loop.
                    logger.exception(
                        "agent loop iteration failed: %s", persona.agent_id
                    )
        except asyncio.CancelledError:
            raise

    async def _one_turn(self, agent, persona: TraderPersona) -> None:
        with logfire.span("agent_turn", agent_id=persona.agent_id):
            # Pull a token-budgeted memory block BEFORE building the LLM
            # context so it can be spliced in as a top-of-prompt frame. The
            # recall is bounded (~1s); when MuBit is disabled or the call
            # times out, this returns "" and we proceed without prior memory.
            memory_query = _memory_query(persona)
            memory_block = await memory.recall_context(
                persona=persona, query=memory_query
            )
            ctx = build_trader_context(
                persona=persona,
                exchange=exchange_runtime.exchange,
                news_bus=exchange_runtime.news_bus,
                memory=memory_block,
            )
            # Record exactly which headlines this agent saw and how many of
            # them count as [NEW] for this persona. If agents stop reacting
            # to a headline you injected, this log line lets you confirm
            # whether the headline was even in the prompt — the Logfire
            # bridge JSON-serialises the kwargs into queryable span attrs.
            window_s = fresh_window_s(persona)
            fresh_count = sum(1 for n in ctx.news if n.seconds_ago < window_s)
            logger.info(
                "agent_turn_inputs",
                extra={
                    "agent_id": persona.agent_id,
                    "news_total": len(ctx.news),
                    "news_fresh": fresh_count,
                    "memory_chars": len(memory_block),
                    "news_headlines": [
                        {
                            "headline": n.headline[:120],
                            "source": n.source,
                            "seconds_ago": round(n.seconds_ago, 2),
                            "pct_change_since": round(n.pct_change_since, 4),
                            "fresh": n.seconds_ago < window_s,
                        }
                        for n in ctx.news
                    ],
                },
            )
            result = await agent.run(TURN_PROMPT, deps=ctx)
            decision: TraderDecision = result.output
            logger.info(
                "agent_turn_decision agent_id=%s action=%s qty=%d conf=%.2f news_fresh=%d",
                persona.agent_id,
                decision.action.value,
                decision.quantity,
                decision.confidence,
                fresh_count,
            )
            # Persist the decision to memory BEFORE broadcasting/submitting so
            # a slow MuBit call can't block the order path. Fire-and-forget —
            # the call returns immediately and runs in the background.
            memory.remember_decision_async(persona=persona, decision=decision, ctx=ctx)
            # Broadcast every decision (including HOLDs) to the order-log SSE
            # stream. This is the single source of truth for the UI panel —
            # killed orders are also represented here as their original decision.
            exchange_runtime.record_decision(persona, decision)
            qty = decision.to_signed_qty()
            if qty == 0:
                return
            exchange_runtime.exchange.submit(
                Order(
                    agent_id=persona.agent_id,
                    limit=decision.limit_price,
                    qty=qty,
                )
            )


def _memory_query(persona: TraderPersona) -> str:
    """The recall query used per turn — kept stable per persona so MuBit's
    embedding-side cache can hit. Persona name + horizon nudges retrieval
    toward this trader's own past reasoning + recent shared headlines."""
    return (
        f"What lessons and recent events should {persona.display_name} "
        f"({persona.archetype.value}, {persona.time_horizon.value}) consider "
        f"for the next decision?"
    )


# Module-level singleton — single shared swarm per backend process.
agent_swarm = AgentSwarmRuntime()
