"""Exchange engine: MM state + agent ledger + FOK matching + depth-weighted Kyle λ fair update."""

from __future__ import annotations

import random
from bisect import bisect_right
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
    PricePoint,
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
        history_cap: int = 7_200,  # ~2h at 1 Hz event cadence
    ) -> None:
        self.params = replace(params, salt_seed=session_seed)
        self.state = MMState(fair=float(initial_fair))
        self._tick_id: int = 0
        self._event_tick: int = 0
        self._pending: list[Order] = []
        self._accounts: dict[str, Account] = {}
        self._recent_trades: deque[Fill] = deque(maxlen=recent_trades_cap)
        # Fills produced by the most recent tick(). Available for any consumer
        # that wants to react to the *new* fills only, vs. the rolling
        # _recent_trades buffer that re-publishes old fills on every snapshot.
        self.last_tick_fills: tuple[Fill, ...] = ()

        # Price history — append-only list of PricePoints, one per fair mutation.
        # We store as a list (not deque) so bisect_right can do O(log n) lookups;
        # trimmed in bulk when we exceed cap to keep amortised append cheap.
        self._history: list[PricePoint] = [
            PricePoint(tick_id=0, fair=float(initial_fair))
        ]
        self._history_cap = history_cap

    # ------------------------------------------------------------------ registration / ledger

    def register(self, agent_id: str, initial_cash: float = 0.0) -> None:
        """Register an agent. Idempotent — re-registration does not reset state."""
        if agent_id not in self._accounts:
            self._accounts[agent_id] = Account(
                agent_id=agent_id,
                cash=float(initial_cash),
                initial_cash=float(initial_cash),
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
        """
        Queue an FOK intent for the next event tick.

        Use this from agent code where many agents act in the same turn — the queue
        gets shuffled and serialized so no agent gets a first-mover advantage from
        real wall-clock latency. For interactive / one-shot orders that should fire
        immediately and return a result, use :meth:`execute_now` instead.
        """
        self.register(order.agent_id)
        self._pending.append(order)

    def execute_now(self, order: Order) -> OrderResult:
        """
        Execute an FOK against the current ladder *immediately* and return the result.

        Bypasses the pending queue and the event-tick cadence. Useful for HTTP-driven
        / human submissions where the caller wants to see filled/killed/hold without
        waiting for the next event tick.
        """
        self.register(order.agent_id)
        return self._execute(order)

    def tick(self, advance_event: bool = True) -> Snapshot:
        """
        Advance one tick.

        Always increments `tick_id` (salt re-rolls, UI 'breathes').
        If `advance_event` and there are pending orders, processes them in a shuffled serial order,
        mutating MM fair and agent ledgers between fills.

        Side-effect: ``self.last_tick_fills`` is rebuilt to hold only the fills
        produced by *this* tick (in execution order), so consumers can react to
        fresh fills without diffing the rolling buffer.
        """
        self._tick_id += 1
        new_fills: list[Fill] = []
        if advance_event and self._pending:
            self._event_tick += 1
            orders = list(self._pending)
            self._pending.clear()
            random.Random(
                f"shuffle:{self.params.salt_seed}:{self._event_tick}"
            ).shuffle(orders)
            for o in orders:
                result = self._execute(o)
                if isinstance(result, Fill):
                    new_fills.append(result)
        self.last_tick_fills = tuple(new_fills)
        return self._snapshot()

    def snapshot(self) -> Snapshot:
        return self._snapshot()

    # ------------------------------------------------------------------ exchange time / price history

    @property
    def current_tick_id(self) -> int:
        """Authoritative integer clock for news anchoring / replay."""
        return self._tick_id

    def price_at(self, tick_id: int) -> float | None:
        """Fair at the given tick — i.e. the last recorded fair whose tick_id ≤ `tick_id`.

        Used by news observation to compute `pct_change_since` relative to the
        fair that was in effect when a headline dropped. Returns None only if
        the history is empty (shouldn't happen — we seed at construction).
        """
        if not self._history:
            return None
        idx = bisect_right(self._history, tick_id, key=lambda p: p.tick_id) - 1
        return self._history[idx].fair if idx >= 0 else None

    def price_history(self, since_tick: int | None = None) -> tuple[PricePoint, ...]:
        """Return price history, optionally sliced to `tick_id ≥ since_tick`."""
        if since_tick is None:
            return tuple(self._history)
        # Bisect to find the cut — linear scan for tiny since values is fine.
        cut = bisect_right(self._history, since_tick - 1, key=lambda p: p.tick_id)
        return tuple(self._history[cut:])

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
        self._record_price()

        fill = Fill(
            agent_id=order.agent_id, qty=order.qty, vwap=vwap, levels=tuple(filled)
        )
        self._recent_trades.append(fill)
        return fill

    def _record_price(self) -> None:
        """Append a PricePoint at the current (tick_id, fair). Trim in bulk when over cap."""
        self._history.append(PricePoint(tick_id=self._tick_id, fair=self.state.fair))
        # Amortised bulk-trim: when we exceed cap, drop the oldest 10% in one slice.
        if len(self._history) > self._history_cap:
            trim = len(self._history) - int(self._history_cap * 0.9)
            del self._history[:trim]

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
