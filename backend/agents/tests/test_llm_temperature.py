"""Verify the high-temperature default and env-var override land on the Agent.

The simulator wants high sampling temperature so a swarm of ~100 personas
produces divergent decisions instead of collapsing onto the same trade.
These tests guard the plumbing: env parsing, fallback on bad input, the
default constant, and that `model_settings.temperature` is actually attached
to the constructed pydantic-ai Agent.
"""

from __future__ import annotations

import pytest

from agents.llm import (
    DEFAULT_TEMPERATURE,
    _trader_agent_for_model,
    build_trader_agent,
    default_temperature,
)


@pytest.fixture(autouse=True)
def _isolated_agent_factory(monkeypatch):
    """Set up a clean factory state for each test:

    * Clear the ``_trader_agent_for_model`` LRU cache so env tweaks
      (LLM_TEMPERATURE) actually rebuild the Agent.
    * Provide a fake gateway API key so ``Agent(...)`` construction succeeds
      in CI / local dev without requiring real credentials. We never call
      ``agent.run(...)`` in this file — only inspect ``agent.model_settings``.
    """
    monkeypatch.setenv("PYDANTIC_AI_GATEWAY_API_KEY", "test-key-not-real")
    _trader_agent_for_model.cache_clear()
    yield
    _trader_agent_for_model.cache_clear()


def test_default_temperature_is_high(monkeypatch):
    """No env var → falls back to DEFAULT_TEMPERATURE, which must be high
    (>=1.0) so the swarm produces variety out of the box."""
    monkeypatch.delenv("LLM_TEMPERATURE", raising=False)
    assert default_temperature() == DEFAULT_TEMPERATURE
    assert DEFAULT_TEMPERATURE >= 1.0


def test_env_override_is_parsed(monkeypatch):
    monkeypatch.setenv("LLM_TEMPERATURE", "0.42")
    assert default_temperature() == pytest.approx(0.42)


def test_env_override_blank_falls_back(monkeypatch):
    monkeypatch.setenv("LLM_TEMPERATURE", "   ")
    assert default_temperature() == DEFAULT_TEMPERATURE


def test_env_override_unparseable_falls_back(monkeypatch):
    """A typo in .env must not crash the loop — fall back to default."""
    monkeypatch.setenv("LLM_TEMPERATURE", "not_a_number")
    assert default_temperature() == DEFAULT_TEMPERATURE


def test_build_trader_agent_attaches_temperature(monkeypatch):
    """The Agent the swarm runs must carry `model_settings.temperature` so the
    LLM provider actually sees it in the request body."""
    monkeypatch.setenv("LLM_TEMPERATURE", "1.25")
    agent = build_trader_agent()
    settings = agent.model_settings or {}
    assert settings.get("temperature") == pytest.approx(1.25)


def test_build_trader_agent_per_call_override_wins(monkeypatch):
    """Per-call override takes precedence over the env var (used for hero
    personas with bespoke temperature)."""
    monkeypatch.setenv("LLM_TEMPERATURE", "1.25")
    agent = build_trader_agent(temperature=0.4)
    settings = agent.model_settings or {}
    assert settings.get("temperature") == pytest.approx(0.4)


def test_build_trader_agent_caches_per_temperature(monkeypatch):
    """Two different temperatures must produce two distinct cached Agents
    so a hero persona's settings don't leak into the swarm Agent."""
    monkeypatch.delenv("LLM_TEMPERATURE", raising=False)
    a = build_trader_agent(temperature=1.1)
    b = build_trader_agent(temperature=0.4)
    c = build_trader_agent(temperature=1.1)
    assert a is c, "same temperature must hit the cache"
    assert a is not b, "different temperatures must build different Agents"
