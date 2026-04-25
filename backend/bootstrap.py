"""Yahoo Finance bootstrap: turn a ticker symbol into a runnable simulation seed.

Why this lives next to (not inside) `yahoo_finance_api.py`:
    The HTTP route returns the full kitchen-sink payload for the debug UI. The
    simulation only needs three things: a starting fair price, a display name,
    and a handful of recent headlines to seed the news bus. Keeping that
    projection here means the Yahoo route stays a pure data dump and the
    bootstrap path doesn't depend on FastAPI / HTTPException.

Resilience model:
    * Network / yfinance failures raise ``BootstrapError`` so the caller can
      decide between hard-failing and falling back (cold startup falls back,
      the spawn endpoint surfaces the error).
    * Yahoo's news shape has been migrated at least twice (legacy flat dict →
      ``content``-nested). ``_normalise_yahoo_news`` accepts both.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from news import NewsHeadline
from yahoo_finance_api import _fetch_ticker_payload, _validate_ticker

logger = logging.getLogger(__name__)


# Number of recent Yahoo headlines to publish into the news bus on bootstrap.
# Small on purpose — these are flavour text for the LLM, not a backfill.
DEFAULT_SEED_NEWS_COUNT = 5

# Order of preference when selecting the seed price. Yahoo's `info` dict is
# inconsistent across asset classes (crypto fills `regularMarketPrice` but not
# `currentPrice`; some thinly-traded names only have `previousClose`).
_PRICE_FIELDS: tuple[str, ...] = (
    "currentPrice",
    "regularMarketPrice",
    "previousClose",
    "regularMarketPreviousClose",
    "open",
    "regularMarketOpen",
)


class BootstrapError(RuntimeError):
    """Raised when Yahoo data cannot be projected into a valid bootstrap payload."""


@dataclass(frozen=True)
class BootstrapPayload:
    """Everything the runtime needs to (re)spawn the simulation around a ticker."""

    ticker: str
    name: str
    initial_fair: float
    seed_news: list[NewsHeadline] = field(default_factory=list)
    fetched_at: str = ""


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _pick_price(quote: dict[str, Any]) -> float | None:
    """Walk the price-field preference order, returning the first finite > 0."""
    for key in _PRICE_FIELDS:
        v = quote.get(key)
        if isinstance(v, (int, float)) and v > 0:
            return float(v)
    return None


def _pick_name(profile: dict[str, Any], fallback: str) -> str:
    for key in ("longName", "shortName", "symbol"):
        v = profile.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return fallback


def _normalise_yahoo_news(items: list[Any] | None) -> list[tuple[str, str, str | None]]:
    """Project Yahoo's news list into ``[(headline, source, body_or_None), ...]``.

    Yahoo / yfinance returns either:
      * Legacy flat shape: ``{title, publisher, link, summary?, ...}``
      * New nested shape:  ``{content: {title, summary, provider: {displayName}, ...}}``

    We normalise both. Items missing a usable title are skipped silently.
    """
    if not items:
        return []
    out: list[tuple[str, str, str | None]] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        # New shape — title is nested under `content`.
        content = raw.get("content")
        if isinstance(content, dict):
            title = content.get("title")
            summary = content.get("summary") or content.get("description")
            provider = content.get("provider")
            source = (
                provider.get("displayName")
                if isinstance(provider, dict)
                else content.get("publisher")
            )
        else:
            # Legacy flat shape.
            title = raw.get("title")
            summary = raw.get("summary") or raw.get("description")
            source = raw.get("publisher")
        if not isinstance(title, str) or not title.strip():
            continue
        body = summary.strip() if isinstance(summary, str) and summary.strip() else None
        out.append(
            (
                title.strip()[:512],
                (
                    source.strip()
                    if isinstance(source, str) and source.strip()
                    else "yahoo"
                )[:64],
                body[:4000] if body else None,
            )
        )
    return out


def _build_seed_news(items: list[Any] | None, *, limit: int) -> list[NewsHeadline]:
    """Anchor the projected items at ``tick_id=0`` and tag them ``source=yahoo:<publisher>``.

    Headlines are returned newest-first as Yahoo orders them, but we don't rely
    on that — the news bus' rolling buffer is order-preserving on publish.
    """
    headlines: list[NewsHeadline] = []
    for title, source, body in _normalise_yahoo_news(items)[:limit]:
        # Tagging like ``yahoo:Reuters`` keeps the ``source`` field useful for
        # filtering without losing the original publisher name.
        tagged_source = f"yahoo:{source}" if not source.startswith("yahoo") else source
        headlines.append(
            NewsHeadline(
                tick_id=0,
                source=tagged_source[:64],
                headline=title,
                body=body,
            )
        )
    return headlines


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def bootstrap_from_yahoo(
    ticker: str,
    *,
    seed_news_count: int = DEFAULT_SEED_NEWS_COUNT,
) -> BootstrapPayload:
    """Pull just enough Yahoo data to spawn a fresh simulation around ``ticker``.

    Raises:
        BootstrapError: ticker not found, no usable price, or Yahoo entirely
            unreachable. The runtime cold-start path catches this and falls
            back to a hard-coded default; the spawn endpoint surfaces it as 4xx.
    """
    symbol = _validate_ticker(ticker)
    try:
        # Reuse the HTTP route's heavy-lifting fetch — runs on a thread because
        # yfinance is sync. Limit history to the cheapest bucket since we only
        # care about the live `info` and `news` payloads here.
        payload: dict[str, Any] = await asyncio.to_thread(
            _fetch_ticker_payload,
            symbol,
            news_count=max(seed_news_count, 1),
            history_period="5d",
            history_interval="1d",
        )
    except Exception as exc:  # yfinance can raise pretty much anything
        logger.exception("yahoo bootstrap fetch failed ticker=%s", symbol)
        raise BootstrapError(f"yahoo fetch failed for {symbol}: {exc}") from exc

    if not payload.get("found"):
        raise BootstrapError(f"ticker not found on yahoo: {symbol}")

    quote = payload.get("quote") or {}
    profile = payload.get("profile") or {}
    price = _pick_price(quote)
    if price is None:
        raise BootstrapError(f"no usable price in yahoo payload for {symbol}")

    name = _pick_name(profile, fallback=symbol)
    seed_news = _build_seed_news(payload.get("news"), limit=seed_news_count)
    fetched_at = payload.get("fetched_at") or (datetime.utcnow().isoformat() + "Z")

    logger.info(
        "yahoo bootstrap ok ticker=%s name=%s price=%.4f seed_news=%d",
        symbol,
        name,
        price,
        len(seed_news),
    )
    return BootstrapPayload(
        ticker=symbol,
        name=name,
        initial_fair=price,
        seed_news=seed_news,
        fetched_at=fetched_at,
    )
