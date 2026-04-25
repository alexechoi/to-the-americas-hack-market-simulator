"""Yahoo Finance router — pull as much public ticker data as the `yfinance`
client exposes, normalise it into JSON-safe shapes, and ship it in one response.

Why one big endpoint?
    The simulator UI / agents want a single "tell me everything Yahoo knows
    about TICKER" call rather than fanning out 8 requests. Yahoo's public
    endpoints already return overlapping payloads, so batching saves both
    round-trips and rate budget.

Resilience model:
    Every yfinance section is wrapped in `_safe_section` so a single failed
    sub-call (rate limit on news, missing financials, etc.) only nulls out
    that section instead of 5xx-ing the whole response. Errors are logged
    via `logger.exception` (per project convention) and surfaced in
    `response.errors[<section>]` so the caller can see what was skipped.
"""

from __future__ import annotations

import asyncio
import logging
import math
from datetime import date, datetime
from typing import Any, Callable

import logfire
import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/yahoo", tags=["yahoo"])

# Yahoo's symbols are conservative; this covers stocks, ETFs, crypto pairs
# (BTC-USD), FX pairs (EURUSD=X), futures (CL=F), and indices (^GSPC).
_MAX_TICKER_LEN = 24
_DEFAULT_NEWS_COUNT = 10
_DEFAULT_HISTORY_PERIOD = "1mo"
_DEFAULT_HISTORY_INTERVAL = "1d"


# ---------------------------------------------------------------------------
# JSON sanitisation
# ---------------------------------------------------------------------------


def _jsonable(value: Any) -> Any:
    """Coerce yfinance / pandas / numpy values into JSON-friendly Python types.

    yfinance returns a soup of `pandas.Timestamp`, `numpy.int64`, NaN, and
    nested DataFrames. FastAPI's default JSON encoder chokes on most of those,
    so we walk the structure once and normalise everything.
    """
    if value is None:
        return None
    if isinstance(value, float):
        # NaN / inf are not valid JSON.
        return value if math.isfinite(value) else None
    if isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()
    if isinstance(value, pd.Timedelta):
        return value.isoformat()
    if isinstance(value, pd.DataFrame):
        # Records keyed by row index keeps date-indexed frames readable.
        return {
            _jsonable(idx): _jsonable(row.to_dict()) for idx, row in value.iterrows()
        }
    if isinstance(value, pd.Series):
        return {_jsonable(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, dict):
        return {str(_jsonable(k)): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    # numpy scalars expose .item(); fall back to str for anything else.
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return _jsonable(item())
        except Exception:
            logger.exception("jsonable item() failed for %r", type(value))
    return str(value)


# ---------------------------------------------------------------------------
# Section helpers
# ---------------------------------------------------------------------------


def _safe_section(
    name: str,
    fn: Callable[[], Any],
    errors: dict[str, str],
) -> Any:
    """Run `fn`, return its sanitised output, or record the error and return None."""
    try:
        return _jsonable(fn())
    except Exception as exc:
        logger.exception("yahoo section failed name=%s", name)
        errors[name] = f"{type(exc).__name__}: {exc}"
        return None


# Keep the top-level `info` payload navigable — pull out the high-signal
# fields the UI actually wants while keeping the raw dict for power users.
_PROFILE_KEYS = (
    "symbol",
    "shortName",
    "longName",
    "quoteType",
    "exchange",
    "fullExchangeName",
    "currency",
    "financialCurrency",
    "market",
    "country",
    "city",
    "state",
    "address1",
    "zip",
    "phone",
    "website",
    "irWebsite",
    "sector",
    "sectorKey",
    "industry",
    "industryKey",
    "longBusinessSummary",
    "fullTimeEmployees",
)
_QUOTE_KEYS = (
    "currentPrice",
    "regularMarketPrice",
    "regularMarketChange",
    "regularMarketChangePercent",
    "previousClose",
    "regularMarketPreviousClose",
    "open",
    "regularMarketOpen",
    "dayHigh",
    "regularMarketDayHigh",
    "dayLow",
    "regularMarketDayLow",
    "bid",
    "ask",
    "bidSize",
    "askSize",
    "volume",
    "regularMarketVolume",
    "averageVolume",
    "averageVolume10days",
    "averageDailyVolume10Day",
    "averageDailyVolume3Month",
    "marketState",
    "preMarketPrice",
    "postMarketPrice",
)
_VALUATION_KEYS = (
    "marketCap",
    "enterpriseValue",
    "trailingPE",
    "forwardPE",
    "priceToBook",
    "priceToSalesTrailing12Months",
    "enterpriseToRevenue",
    "enterpriseToEbitda",
    "pegRatio",
    "trailingPegRatio",
    "bookValue",
)
_PROFITABILITY_KEYS = (
    "profitMargins",
    "grossMargins",
    "operatingMargins",
    "ebitdaMargins",
    "returnOnAssets",
    "returnOnEquity",
    "revenueGrowth",
    "earningsGrowth",
    "earningsQuarterlyGrowth",
    "totalRevenue",
    "revenuePerShare",
    "grossProfits",
    "ebitda",
    "netIncomeToCommon",
    "totalCash",
    "totalCashPerShare",
    "totalDebt",
    "debtToEquity",
    "currentRatio",
    "quickRatio",
    "freeCashflow",
    "operatingCashflow",
)
_RANGE_KEYS = (
    "fiftyTwoWeekLow",
    "fiftyTwoWeekHigh",
    "fiftyTwoWeekChange",
    "52WeekChange",
    "fiftyDayAverage",
    "twoHundredDayAverage",
    "beta",
    "SandP52WeekChange",
)
_DIVIDEND_KEYS = (
    "dividendRate",
    "dividendYield",
    "trailingAnnualDividendRate",
    "trailingAnnualDividendYield",
    "fiveYearAvgDividendYield",
    "payoutRatio",
    "exDividendDate",
    "lastDividendValue",
    "lastDividendDate",
)
_SHARES_KEYS = (
    "sharesOutstanding",
    "floatShares",
    "impliedSharesOutstanding",
    "sharesShort",
    "sharesShortPriorMonth",
    "shortRatio",
    "shortPercentOfFloat",
    "heldPercentInsiders",
    "heldPercentInstitutions",
)
_EARNINGS_KEYS = (
    "trailingEps",
    "forwardEps",
    "epsTrailingTwelveMonths",
    "epsForward",
    "epsCurrentYear",
    "priceEpsCurrentYear",
    "earningsTimestamp",
    "earningsTimestampStart",
    "earningsTimestampEnd",
)
_ANALYST_KEYS = (
    "recommendationKey",
    "recommendationMean",
    "numberOfAnalystOpinions",
    "targetHighPrice",
    "targetLowPrice",
    "targetMeanPrice",
    "targetMedianPrice",
    "averageAnalystRating",
)


def _pick(info: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    """Project the listed keys from `info`, dropping missing ones (not None)."""
    return {k: _jsonable(info[k]) for k in keys if k in info}


def _summarise_history(hist: pd.DataFrame) -> dict[str, Any] | None:
    """Compress a price history DataFrame into a compact summary + the rows."""
    if hist is None or hist.empty:
        return None
    closes = hist["Close"].dropna()
    summary: dict[str, Any] = {
        "rows": _jsonable(hist),
        "row_count": int(len(hist)),
        "first_date": _jsonable(hist.index[0]),
        "last_date": _jsonable(hist.index[-1]),
    }
    if not closes.empty:
        first, last = float(closes.iloc[0]), float(closes.iloc[-1])
        summary["first_close"] = first
        summary["last_close"] = last
        summary["pct_change"] = (last - first) / first if first else None
        summary["high"] = float(hist["High"].max()) if "High" in hist else None
        summary["low"] = float(hist["Low"].min()) if "Low" in hist else None
        if "Volume" in hist:
            summary["avg_volume"] = float(hist["Volume"].mean())
    return _jsonable(summary)


# ---------------------------------------------------------------------------
# Blocking worker — runs on the threadpool via `asyncio.to_thread`
# ---------------------------------------------------------------------------


def _fetch_ticker_payload(
    ticker_symbol: str,
    *,
    news_count: int,
    history_period: str,
    history_interval: str,
) -> dict[str, Any]:
    """Synchronous yfinance scrape. Don't call from the event loop directly."""
    ticker = yf.Ticker(ticker_symbol)
    errors: dict[str, str] = {}

    # `info` is the linchpin — most slices below are derived from it.
    info: dict[str, Any] = _safe_section("info", lambda: ticker.info, errors) or {}

    payload: dict[str, Any] = {
        "ticker": ticker_symbol.upper(),
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "profile": _pick(info, _PROFILE_KEYS),
        "quote": _pick(info, _QUOTE_KEYS),
        "valuation": _pick(info, _VALUATION_KEYS),
        "profitability": _pick(info, _PROFITABILITY_KEYS),
        "range": _pick(info, _RANGE_KEYS),
        "dividends": _pick(info, _DIVIDEND_KEYS),
        "shares": _pick(info, _SHARES_KEYS),
        "earnings": _pick(info, _EARNINGS_KEYS),
        "analyst": _pick(info, _ANALYST_KEYS),
        "officers": _jsonable(info.get("companyOfficers")),
        "fast_info": _safe_section("fast_info", lambda: dict(ticker.fast_info), errors),
        "calendar": _safe_section("calendar", lambda: ticker.calendar, errors),
        "recommendations": _safe_section(
            "recommendations", lambda: ticker.recommendations, errors
        ),
        "recommendations_summary": _safe_section(
            "recommendations_summary",
            lambda: ticker.recommendations_summary,
            errors,
        ),
        "upgrades_downgrades": _safe_section(
            "upgrades_downgrades", lambda: ticker.upgrades_downgrades, errors
        ),
        "analyst_price_targets": _safe_section(
            "analyst_price_targets", lambda: ticker.analyst_price_targets, errors
        ),
        "earnings_dates": _safe_section(
            "earnings_dates", lambda: ticker.earnings_dates, errors
        ),
        "earnings_estimate": _safe_section(
            "earnings_estimate", lambda: ticker.earnings_estimate, errors
        ),
        "revenue_estimate": _safe_section(
            "revenue_estimate", lambda: ticker.revenue_estimate, errors
        ),
        "growth_estimates": _safe_section(
            "growth_estimates", lambda: ticker.growth_estimates, errors
        ),
        "income_stmt": _safe_section("income_stmt", lambda: ticker.income_stmt, errors),
        "quarterly_income_stmt": _safe_section(
            "quarterly_income_stmt", lambda: ticker.quarterly_income_stmt, errors
        ),
        "balance_sheet": _safe_section(
            "balance_sheet", lambda: ticker.balance_sheet, errors
        ),
        "quarterly_balance_sheet": _safe_section(
            "quarterly_balance_sheet", lambda: ticker.quarterly_balance_sheet, errors
        ),
        "cashflow": _safe_section("cashflow", lambda: ticker.cashflow, errors),
        "quarterly_cashflow": _safe_section(
            "quarterly_cashflow", lambda: ticker.quarterly_cashflow, errors
        ),
        "major_holders": _safe_section(
            "major_holders", lambda: ticker.major_holders, errors
        ),
        "institutional_holders": _safe_section(
            "institutional_holders", lambda: ticker.institutional_holders, errors
        ),
        "mutualfund_holders": _safe_section(
            "mutualfund_holders", lambda: ticker.mutualfund_holders, errors
        ),
        "insider_transactions": _safe_section(
            "insider_transactions", lambda: ticker.insider_transactions, errors
        ),
        "insider_purchases": _safe_section(
            "insider_purchases", lambda: ticker.insider_purchases, errors
        ),
        "insider_roster_holders": _safe_section(
            "insider_roster_holders", lambda: ticker.insider_roster_holders, errors
        ),
        "sustainability": _safe_section(
            "sustainability", lambda: ticker.sustainability, errors
        ),
        "isin": _safe_section("isin", lambda: ticker.isin, errors),
        "sec_filings": _safe_section("sec_filings", lambda: ticker.sec_filings, errors),
        "options_expirations": _safe_section(
            "options_expirations", lambda: list(ticker.options or ()), errors
        ),
        "history": _safe_section(
            "history",
            lambda: _summarise_history(
                ticker.history(period=history_period, interval=history_interval)
            ),
            errors,
        ),
        "news": _safe_section(
            "news", lambda: ticker.get_news(count=news_count), errors
        ),
        "raw_info": _jsonable(info) if info else None,
    }

    if errors:
        payload["errors"] = errors
    # Yahoo doesn't 404 for bogus tickers — `info` comes back as a tiny stub
    # (e.g. `{'trailingPegRatio': None}`). The presence of an identifying
    # name field is the most reliable "real ticker" signal across stocks,
    # ETFs, indices, crypto pairs, and FX.
    payload["found"] = any(
        info.get(k) for k in ("symbol", "shortName", "longName", "quoteType")
    )
    return payload


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


class TickerResponse(BaseModel):
    """Loose wrapper — the payload is intentionally heterogeneous."""

    model_config = {"extra": "allow"}

    ticker: str
    found: bool


def _validate_ticker(ticker: str) -> str:
    cleaned = ticker.strip().upper()
    if not cleaned or len(cleaned) > _MAX_TICKER_LEN:
        raise HTTPException(status_code=400, detail="invalid ticker")
    # Yahoo symbols include letters, digits, and `.-=^` (e.g. BRK-B, ^GSPC, EURUSD=X).
    if not all(c.isalnum() or c in ".-=^" for c in cleaned):
        raise HTTPException(status_code=400, detail="invalid ticker characters")
    return cleaned


@router.get("/ticker/{ticker}", response_model=TickerResponse)
async def get_ticker(
    ticker: str,
    news_count: int = _DEFAULT_NEWS_COUNT,
    history_period: str = _DEFAULT_HISTORY_PERIOD,
    history_interval: str = _DEFAULT_HISTORY_INTERVAL,
) -> dict[str, Any]:
    """Return everything yfinance can pull for `ticker` in one shot.

    Query params:
        news_count       — max news articles to attach (default 10).
        history_period   — yfinance period string (1d, 5d, 1mo, 3mo, 1y, 5y, max).
        history_interval — 1m, 5m, 15m, 1h, 1d, 1wk, 1mo.
    """
    symbol = _validate_ticker(ticker)
    news_count = max(1, min(news_count, 50))

    with logfire.span("yahoo_ticker", ticker=symbol):
        payload = await asyncio.to_thread(
            _fetch_ticker_payload,
            symbol,
            news_count=news_count,
            history_period=history_period,
            history_interval=history_interval,
        )

    if not payload.get("found"):
        # 404 for unknown tickers so callers can branch on status; payload
        # still includes the `errors` map so the body explains why.
        logger.info("yahoo_ticker not_found symbol=%s", symbol)
        raise HTTPException(status_code=404, detail=payload)

    logger.info(
        "yahoo_ticker ok symbol=%s sections_failed=%d",
        symbol,
        len(payload.get("errors") or {}),
    )
    return payload
