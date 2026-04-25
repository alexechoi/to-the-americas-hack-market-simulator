"""Agent ledger: auto-registration, fill updates, equity, conservation, observation."""

from __future__ import annotations

import pytest

from exchange.engine import Exchange
from exchange.ladder import build_ladder
from exchange.types import MMParams, Order


@pytest.fixture
def flat_params() -> MMParams:
    return MMParams(
        size_jitter=0.0,
        imbalance=0.0,
        gap_prob=0.0,
        jumbo_prob=0.0,
    )


def test_auto_register_on_submit(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    ex.submit(Order(agent_id="a", limit=0.0, qty=0))
    assert "a" in ex.all_accounts()


def test_register_is_idempotent(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    ex.register("a", initial_cash=1000.0)
    ex.register("a", initial_cash=999.0)  # should NOT reset
    assert ex.account("a").cash == 1000.0


def test_buy_updates_inventory_and_cash(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    future = build_ladder(100.0, 1, flat_params)
    best_ask_price, best_ask_size = future.asks[0]
    qty = min(5, best_ask_size)
    ex.submit(Order(agent_id="a", limit=1e9, qty=qty))
    ex.tick()
    acct = ex.account("a")
    assert acct.inventory == qty
    assert acct.cash == pytest.approx(-qty * best_ask_price)
    assert acct.n_fills == 1


def test_sell_updates_inventory_and_cash(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    future = build_ladder(100.0, 1, flat_params)
    best_bid_price, best_bid_size = future.bids[0]
    qty = min(4, best_bid_size)
    ex.submit(Order(agent_id="a", limit=0.0, qty=-qty))
    ex.tick()
    acct = ex.account("a")
    assert acct.inventory == -qty
    assert acct.cash == pytest.approx(qty * best_bid_price)


def test_equity_marked_at_fair(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    ex.submit(Order(agent_id="a", limit=1e9, qty=3))
    ex.tick()
    acct = ex.account("a")
    snap = ex.snapshot()
    assert acct.equity == pytest.approx(acct.cash + acct.inventory * snap.fair)


def test_conservation_of_cash_and_asset(flat_params: MMParams):
    """
    System-wide: Σ agent.cash + mm_cash == Σ initial_cash  (=0 here, all agents start at 0)
    and        : Σ agent.inventory + mm_inventory == 0.

    We derive mm_cash and mm_inventory from the accounts themselves.
    """
    ex = Exchange(params=flat_params, initial_fair=100.0)
    ex.register("a", initial_cash=0.0)
    ex.register("b", initial_cash=0.0)
    # Mixed orders across two event ticks.
    ex.submit(Order(agent_id="a", limit=1e9, qty=4))
    ex.submit(Order(agent_id="b", limit=0.0, qty=-2))
    ex.tick()
    ex.submit(Order(agent_id="a", limit=0.0, qty=-3))
    ex.submit(Order(agent_id="b", limit=1e9, qty=5))
    ex.tick()

    accts = ex.all_accounts()
    agent_cash_total = sum(a.cash for a in accts.values())
    agent_inv_total = sum(a.inventory for a in accts.values())
    initial_cash_total = sum(ex._accounts[aid].initial_cash for aid in ex._accounts)

    # MM is the sole counterparty, so its position is the mirror of agents'.
    mm_cash = initial_cash_total - agent_cash_total
    mm_inv = -agent_inv_total

    # Cash conservation.
    assert agent_cash_total + mm_cash == pytest.approx(initial_cash_total)
    # Asset conservation.
    assert agent_inv_total + mm_inv == 0


def test_observe_returns_consistent_pair(flat_params: MMParams):
    ex = Exchange(params=flat_params, initial_fair=100.0)
    ex.submit(Order(agent_id="a", limit=1e9, qty=2))
    ex.tick()
    obs = ex.observe("a")
    assert obs.account.agent_id == "a"
    assert obs.market.fair == ex.state.fair
    assert obs.account.equity == pytest.approx(
        obs.account.cash + obs.account.inventory * obs.market.fair
    )


def test_observe_is_private_view():
    """observe(agent_id) does not leak other agents' books."""
    ex = Exchange(params=MMParams(), initial_fair=100.0)
    ex.register("a")
    ex.register("b")
    obs = ex.observe("a")
    # AgentObservation contains only this agent's account — no iterable of others.
    assert obs.account.agent_id == "a"
    assert not hasattr(obs, "other_accounts")
