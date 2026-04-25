"""Exchange engine: MM state + agent ledger + FOK matching + depth-weighted Kyle λ fair update."""

from __future__ import annotations

import random
from collections import deque
from dataclasses import replace

from .ladder import build_ladder, half_spread
from .types import (
    Account,
    AccountSnapshot,
    AgentObservation,
    Fill,
    Hold,
    Killed,
    Ladder,
    MMParams,
    MMState,
    Order,
    OrderResult,
    Snapshot,
)


class Exchange:
    """
    Tick-based exchange with one implicit market maker as sole counterparty.

    Cadences:
      - UI / "breathing" ticks:   `tick(advance_event=False)`  — salt re-rolls, no fills
      - Event ticks (agent turn): `tick(advance_event=True)`   — drains queued FOKs, fair updates
    """

    def __init__(
        self,
        params: MMParams,
        initial_fair: float,
        session_seed: int = 0,
        recent_trades_cap: int = 200,
    ) -> None:
        self.params = replace(params, salt_seed=session_seed)
        self.state = MMState(fair=float(initial_fair))
        self._tick_id: int = 0
        self._event_tick: int = 0
        self._pending: list[Order] = []
        self._accounts: dict[str, Account] = {}
        self._recent_trades: deque[Fill] = deque(maxlen=recent_trades_cap)

    # ------------------------------------------------------------------ registration / ledger

    def register(self, agent_id: str, initial_cash: float = 0.0) -> None:
        """Register an agent. Idempotent — re-registration does not reset state."""
        if agent_id not in self._accounts:
            self._accounts[agent_id] = Account(
                agent_id=agent_id, cash=float(initial_cash), initial_cash=float(initial_cash),
            )

    def account(self, agent_id: str) -> AccountSnapshot:
        a = self._accounts[agent_id]
        return AccountSnapshot(
            agent_id=a.agent_id,
            inventory=a.inventory,
            cash=a.cash,
            equity=a.cash + a.inventory * self.state.fair,
            n_fills=a.n_fills,
        )

    def all_accounts(self) -> dict[str, AccountSnapshot]:
        return {aid: self.account(aid) for aid in self._accounts}

    def observe(self, agent_id: str) -> AgentObservation:
        """Canonical 'what this agent sees right now': public market + own private account."""
        self.register(agent_id)
        return AgentObservation(market=self._snapshot(), account=self.account(agent_id))

    # ------------------------------------------------------------------ order flow

    def submit(self, order: Order) -> None:
        """Queue an FOK intent for the next event tick. Auto-registers the agent."""
        self.register(order.agent_id)
        self._pending.append(order)

    def tick(self, advance_event: bool = True) -> Snapshot:
        """
        Advance one tick.

        Always increments `tick_id` (salt re-rolls, UI 'breathes').
        If `advance_event` and there are pending orders, processes them in a shuffled serial order,
        mutating MM fair and agent ledgers between fills.
        """
        self._tick_id += 1
        if advance_event and self._pending:
            self._event_tick += 1
            orders = list(self._pending)
            self._pending.clear()
            random.Random(f"shuffle:{self.params.salt_seed}:{self._event_tick}").shuffle(orders)
            for o in orders:
                self._execute(o)
        return self._snapshot()

    def snapshot(self) -> Snapshot:
        return self._snapshot()

    # ------------------------------------------------------------------ internals

    def _current_ladder(self) -> Ladder:
        return build_ladder(self.state.fair, self._tick_id, self.params)

    def _execute(self, order: Order) -> OrderResult:
        if order.qty == 0:
            return Hold(agent_id=order.agent_id)

        ladder = self._current_ladder()
        levels = ladder.asks if order.qty > 0 else ladder.bids
        side = 1 if order.qty > 0 else -1
        need = abs(order.qty)

        filled: list[tuple[float, int]] = []
        limit_blocked = False
        for price, size in levels:
            if side > 0 and price > order.limit:
                limit_blocked = True
                break
            if side < 0 and price < order.limit:
                limit_blocked = True
                break
            take = min(need, size)
            filled.append((price, take))
            need -= take
            if need == 0:
                break

        if need > 0:
            reason = "limit_not_crossed" if limit_blocked else "insufficient_liquidity"
            return Killed(agent_id=order.agent_id, reason=reason)

        # Capture pre-trade scalars for the Kyle update.
        fair_pre = self.state.fair
        hs_pre = half_spread(self.params)

        # 1. Agent ledger — signed: buy (+qty) spends cash, sell (-qty) earns cash.
        vwap = sum(p * q for p, q in filled) / abs(order.qty)
        acct = self._accounts[order.agent_id]
        acct.inventory += order.qty
        acct.cash -= order.qty * vwap
        acct.n_fills += 1

        # 2. MM fair — depth-weighted Kyle λ.
        #   Δfair = (λ / half_spread_pre) · Σᵢ qᵢ · (pᵢ − fair_pre)
        # qᵢ are unsigned. For buys, filled prices ≥ fair_pre ⇒ Δfair ≥ 0.
        # For sells, filled prices ≤ fair_pre ⇒ Δfair ≤ 0. At top-of-book this reduces to λ·qty.
        impact = sum(q * (p - fair_pre) for p, q in filled)
        self.state.fair += (self.params.kyle_lambda / hs_pre) * impact

        fill = Fill(agent_id=order.agent_id, qty=order.qty, vwap=vwap, levels=tuple(filled))
        self._recent_trades.append(fill)
        return fill

    def _snapshot(self) -> Snapshot:
        hs = half_spread(self.params)
        return Snapshot(
            tick_id=self._tick_id,
            event_tick=self._event_tick,
            fair=self.state.fair,
            best_bid=self.state.fair - hs,
            best_ask=self.state.fair + hs,
            mid=self.state.fair,
            ladder=self._current_ladder(),
            recent_trades=tuple(self._recent_trades),
        )
