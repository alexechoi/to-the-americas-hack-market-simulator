"""``MubitMemory`` no-op behaviour and run_id rotation.

These tests exercise the centralised memory facade WITHOUT a configured
``MUBIT_API_KEY`` — i.e. the path that backend/.env will hit on machines
without MuBit credentials. The contract: every public method must succeed
silently, the recall must return an empty string, and the news-bus integration
must keep publishing even when memory is disabled.

When ``MUBIT_API_KEY`` IS set we just confirm the SDK client is constructed
exactly once (lazy + idempotent), without making any network calls.
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from agents.memory import MubitMemory
from agents.schemas import (
    AccountView,
    LadderLevelView,
    MarketContextView,
    RiskTolerance,
    TimeHorizon,
    TraderAction,
    TraderArchetype,
    TraderContext,
    TraderDecision,
    TraderPersona,
)


@pytest.fixture
def persona() -> TraderPersona:
    return TraderPersona(
        agent_id="agent_test",
        display_name="Tester",
        archetype=TraderArchetype.RETAIL,
        risk_tolerance=RiskTolerance.MODERATE,
        time_horizon=TimeHorizon.SHORT_TERM,
        max_position=500,
        max_order_size=50,
        backstory="Synthetic test persona.",
    )


@pytest.fixture
def ctx(persona: TraderPersona) -> TraderContext:
    return TraderContext(
        persona=persona,
        market=MarketContextView(
            tick_id=1,
            event_tick=0,
            fair=100.0,
            best_bid=99.95,
            best_ask=100.05,
            bids=[LadderLevelView(price=99.95, size=10)],
            asks=[LadderLevelView(price=100.05, size=10)],
            recent_trades=[],
        ),
        account=AccountView(agent_id="agent_test", inventory=0, n_fills=0),
        news=[],
    )


@pytest.fixture
def decision() -> TraderDecision:
    return TraderDecision(
        action=TraderAction.BUY,
        quantity=50,
        limit_price=100.05,
        confidence=0.7,
        reasoning="Lifting on a fresh headline.",
    )


def test_disabled_when_api_key_missing(monkeypatch: pytest.MonkeyPatch):
    """Without ``MUBIT_API_KEY``, configure() leaves the client unset and
    every public method becomes a no-op. This is the local-dev default —
    breaking it would force every contributor to hold MuBit credentials."""
    monkeypatch.delenv("MUBIT_API_KEY", raising=False)
    mem = MubitMemory()
    mem.configure()
    assert mem.enabled is False


def test_recall_returns_empty_when_disabled(persona: TraderPersona):
    """Disabled recall must short-circuit to "" — never raise, never block.
    Callers splice the result straight into the prompt, so a None or
    exception here would crash the agent loop."""
    mem = MubitMemory()
    out = asyncio.run(mem.recall_context(persona=persona, query="anything"))
    assert out == ""


def test_remember_decision_noop_when_disabled(
    persona: TraderPersona, decision: TraderDecision, ctx: TraderContext
):
    mem = MubitMemory()
    mem.remember_decision_async(persona=persona, decision=decision, ctx=ctx)
    mem.remember_headline_async(source="reuters", headline="Fed cuts rates")


def test_set_run_id_safe_when_disabled():
    """``runtime.respawn`` calls ``set_run_id`` unconditionally; a disabled
    memory layer must accept the call and just log."""
    mem = MubitMemory()
    mem.set_run_id("sim-NVDA-1234567890")
    assert mem.enabled is False  # still disabled, just a label tracked locally


def test_configure_idempotent_with_key(monkeypatch: pytest.MonkeyPatch):
    """Calling configure() twice must not rebuild the client — that would
    re-establish gRPC channels for nothing on every lifespan reload."""
    monkeypatch.setenv("MUBIT_API_KEY", "mbt_test_dummy_key")
    fake_client = MagicMock()
    with patch("agents.memory.Client", return_value=fake_client) as ctor:
        mem = MubitMemory()
        mem.configure()
        mem.configure()
        assert ctor.call_count == 1
        assert mem.enabled is True


def test_set_run_id_propagates_to_client_when_enabled(
    monkeypatch: pytest.MonkeyPatch,
):
    """When MuBit is configured, ``set_run_id`` must forward to the SDK so
    the underlying transport stamps the right run on every subsequent call."""
    monkeypatch.setenv("MUBIT_API_KEY", "mbt_test_dummy_key")
    fake_client = MagicMock()
    with patch("agents.memory.Client", return_value=fake_client):
        mem = MubitMemory()
        mem.configure()
        mem.set_run_id("sim-NVDA-42")
    fake_client.set_run_id.assert_called_once_with("sim-NVDA-42")


def test_recall_swallows_sdk_errors(
    monkeypatch: pytest.MonkeyPatch, persona: TraderPersona
):
    """Recall must NEVER raise — a slow / dead MuBit instance can't kill
    the agent loop. We mock ``get_context`` to raise and assert the public
    method still returns ``""``."""
    monkeypatch.setenv("MUBIT_API_KEY", "mbt_test_dummy_key")
    fake_client = MagicMock()
    fake_client.get_context.side_effect = RuntimeError("simulated MuBit outage")
    with patch("agents.memory.Client", return_value=fake_client):
        mem = MubitMemory()
        mem.configure()
        mem.set_run_id("sim-NVDA-42")
        out = asyncio.run(mem.recall_context(persona=persona, query="x"))
    assert out == ""
