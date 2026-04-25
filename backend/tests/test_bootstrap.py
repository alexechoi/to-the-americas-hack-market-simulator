"""Bootstrap helper: Yahoo payload projection + news-shape normalisation.

The full ``bootstrap_from_yahoo`` path goes through ``yahoo_finance_api`` which
calls the live yfinance client. We monkey-patch the inner ``_fetch_ticker_payload``
to keep the tests offline, deterministic, and independent of Yahoo uptime.
"""

from __future__ import annotations

from typing import Any

import pytest

import bootstrap


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def test_pick_price_walks_preference_order():
    """First positive numeric in the preference list wins."""
    quote = {
        "currentPrice": None,
        "regularMarketPrice": 0,  # zero ignored
        "previousClose": 142.18,
        "open": 99.0,  # would lose to previousClose
    }
    assert bootstrap._pick_price(quote) == pytest.approx(142.18)


def test_pick_price_returns_none_when_nothing_usable():
    assert bootstrap._pick_price({}) is None
    assert (
        bootstrap._pick_price({"currentPrice": "N/A", "regularMarketPrice": -1}) is None
    )


def test_pick_name_falls_back_to_symbol():
    assert bootstrap._pick_name({}, fallback="NVDA") == "NVDA"
    assert bootstrap._pick_name({"symbol": "NVDA"}, fallback="X") == "NVDA"
    assert (
        bootstrap._pick_name({"longName": "NVIDIA Corporation"}, fallback="X")
        == "NVIDIA Corporation"
    )
    # longName beats shortName
    assert (
        bootstrap._pick_name(
            {"shortName": "NVIDIA", "longName": "NVIDIA Corporation"}, fallback="X"
        )
        == "NVIDIA Corporation"
    )


# ---------------------------------------------------------------------------
# News-shape normalisation
# ---------------------------------------------------------------------------


def test_normalise_legacy_yahoo_news_shape():
    items = [
        {
            "uuid": "abc",
            "title": "Chips up on demand surge",
            "publisher": "Reuters",
            "summary": "AI workloads are eating capacity.",
        }
    ]
    [(title, source, body)] = bootstrap._normalise_yahoo_news(items)
    assert title == "Chips up on demand surge"
    assert source == "Reuters"
    assert body == "AI workloads are eating capacity."


def test_normalise_new_yahoo_news_shape():
    items = [
        {
            "id": "abc",
            "content": {
                "title": "Chips up on demand surge",
                "summary": "AI workloads are eating capacity.",
                "provider": {"displayName": "Reuters"},
            },
        }
    ]
    [(title, source, body)] = bootstrap._normalise_yahoo_news(items)
    assert title == "Chips up on demand surge"
    assert source == "Reuters"
    assert body == "AI workloads are eating capacity."


def test_normalise_skips_titleless_items():
    items: list[Any] = [
        {"content": {"summary": "no title here"}},
        {"title": "   "},  # whitespace-only
        None,
        "garbage",
        {"title": "good one", "publisher": "X"},
    ]
    out = bootstrap._normalise_yahoo_news(items)
    assert [t for t, _, _ in out] == ["good one"]


def test_build_seed_news_anchors_at_zero_and_tags_source():
    items = [
        {"title": "headline-one", "publisher": "Reuters"},
        {"title": "headline-two", "publisher": "Bloomberg"},
    ]
    seed = bootstrap._build_seed_news(items, limit=5)
    assert [hl.headline for hl in seed] == ["headline-one", "headline-two"]
    assert all(hl.tick_id == 0 for hl in seed)
    assert [hl.source for hl in seed] == ["yahoo:Reuters", "yahoo:Bloomberg"]


def test_build_seed_news_respects_limit():
    items = [{"title": f"h{i}", "publisher": "X"} for i in range(20)]
    seed = bootstrap._build_seed_news(items, limit=3)
    assert len(seed) == 3


# ---------------------------------------------------------------------------
# End-to-end (offline) — bootstrap_from_yahoo
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_yahoo_payload() -> dict[str, Any]:
    """A minimal but realistic Yahoo payload as returned by ``_fetch_ticker_payload``."""
    return {
        "ticker": "NVDA",
        "fetched_at": "2026-04-25T00:00:00Z",
        "found": True,
        "profile": {"longName": "NVIDIA Corporation", "symbol": "NVDA"},
        "quote": {"currentPrice": 142.18},
        "news": [
            {"title": "Chips up on demand", "publisher": "Reuters"},
            {
                "content": {
                    "title": "Datacentre revenue beat",
                    "provider": {"displayName": "Bloomberg"},
                }
            },
        ],
    }


async def test_bootstrap_from_yahoo_projects_payload(
    monkeypatch, fake_yahoo_payload: dict[str, Any]
):
    monkeypatch.setattr(
        bootstrap, "_fetch_ticker_payload", lambda *a, **kw: fake_yahoo_payload
    )
    out = await bootstrap.bootstrap_from_yahoo("nvda", seed_news_count=2)
    assert out.ticker == "NVDA"
    assert out.name == "NVIDIA Corporation"
    assert out.initial_fair == pytest.approx(142.18)
    assert len(out.seed_news) == 2
    assert out.fetched_at == "2026-04-25T00:00:00Z"


async def test_bootstrap_from_yahoo_raises_when_not_found(monkeypatch):
    monkeypatch.setattr(
        bootstrap,
        "_fetch_ticker_payload",
        lambda *a, **kw: {"ticker": "ZZZ", "found": False},
    )
    with pytest.raises(bootstrap.BootstrapError, match="not found"):
        await bootstrap.bootstrap_from_yahoo("ZZZ")


async def test_bootstrap_from_yahoo_raises_when_no_price(monkeypatch):
    monkeypatch.setattr(
        bootstrap,
        "_fetch_ticker_payload",
        lambda *a, **kw: {
            "ticker": "X",
            "found": True,
            "profile": {"symbol": "X"},
            "quote": {},  # no usable price
            "news": [],
        },
    )
    with pytest.raises(bootstrap.BootstrapError, match="no usable price"):
        await bootstrap.bootstrap_from_yahoo("X")


async def test_bootstrap_from_yahoo_wraps_fetch_failures(monkeypatch):
    def boom(*a, **kw):
        raise RuntimeError("yfinance exploded")

    monkeypatch.setattr(bootstrap, "_fetch_ticker_payload", boom)
    with pytest.raises(bootstrap.BootstrapError, match="yfinance exploded"):
        await bootstrap.bootstrap_from_yahoo("NVDA")
