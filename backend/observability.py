"""Centralised observability: Logfire + stdlib logging bridge + Pydantic / Pydantic-AI hooks.

Design notes:
    * `configure_observability()` is idempotent and safe to call multiple times.
    * Locally we run with no `LOGFIRE_TOKEN` — `send_to_logfire='if-token-present'` makes the
      whole pipeline a no-op for the network exporter while still emitting to stdout via
      `console=True`. Set `LOGFIRE_TOKEN` in `.env` (or the platform env) to ship spans.
    * Existing modules already use `logging.getLogger(__name__)`; the `LogfireLoggingHandler`
      bridge means every `logger.info/warning/exception` call also lands in Logfire — no need
      to refactor existing call sites.
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

import logfire

if TYPE_CHECKING:
    from fastapi import FastAPI

_CONFIGURED = False


def configure_observability(*, service_name: str = "market-sim-backend") -> None:
    """Initialise Logfire and route stdlib logging through it. Idempotent."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    logfire.configure(
        service_name=service_name,
        send_to_logfire="if-token-present",
        environment=os.getenv("ENVIRONMENT", "dev"),
        console=logfire.ConsoleOptions(verbose=False),
    )

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    handler = logfire.LogfireLoggingHandler()
    handler.setLevel(logging.INFO)
    if not any(isinstance(h, logfire.LogfireLoggingHandler) for h in root.handlers):
        root.addHandler(handler)

    logfire.instrument_pydantic()
    logfire.instrument_pydantic_ai()

    _CONFIGURED = True
    logging.getLogger(__name__).info(
        "Logfire configured (service=%s, token=%s)",
        service_name,
        "present" if os.getenv("LOGFIRE_TOKEN") else "absent",
    )


def instrument_app(app: FastAPI) -> None:
    """Attach FastAPI request/response auto-instrumentation. Call once after app creation."""
    logfire.instrument_fastapi(app, capture_headers=False)
