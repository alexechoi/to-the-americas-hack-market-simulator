"""Auto-pause lifecycle: stop the simulation when no viewers are watching.

When the last SSE subscriber disconnects from the exchange stream the controller
schedules a pause after ``AUTO_PAUSE_GRACE_S`` seconds (default 60s). The pause
stops both the agent swarm (no more LLM inference / order submission) and the
exchange tick loop (no more snapshot broadcasts or noise drift). If a fresh
subscriber lands inside the grace window the pending pause is cancelled — the
sim never actually stops, so a quick page refresh / route change is invisible.

Cold start: the controller boots **paused** by default. The first SSE
subscriber resumes the sim, which avoids burning LLM tokens before anyone is
watching. Set ``AUTO_PAUSE_ENABLED=false`` to disable this and keep the legacy
"always running on boot" behaviour (useful for live demos / load tests).

Concurrency:

* Subscribe/unsubscribe hooks are synchronous — they run on the SSE handler's
  hot path. The actual start/stop work is dispatched to a background task so
  the hook never blocks the event loop.
* State transitions (running ↔ paused) are guarded by an ``asyncio.Lock`` so a
  race between "last viewer left" and "new viewer joined" can't end with the
  sim wedged half-paused.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Awaitable, Callable

logger = logging.getLogger(__name__)

# Public defaults — kept here so they're visible from ``__init__`` without a
# nested env read. Tests pass overrides directly to skip env parsing entirely.
DEFAULT_GRACE_S = 60.0
DEFAULT_ENABLED = True


def _read_grace_s(default: float = DEFAULT_GRACE_S) -> float:
    raw = os.getenv("AUTO_PAUSE_GRACE_S", str(default))
    try:
        v = float(raw)
        if v < 0:
            raise ValueError("must be non-negative")
        return v
    except ValueError:
        logger.warning(
            "Invalid AUTO_PAUSE_GRACE_S=%r — falling back to %.1f", raw, default
        )
        return default


def _read_enabled(default: bool = DEFAULT_ENABLED) -> bool:
    raw = (
        os.getenv("AUTO_PAUSE_ENABLED", "true" if default else "false").strip().lower()
    )
    return raw in ("1", "true", "yes", "on")


# Function shapes accepted at construction. Sync ``start`` mirrors the runtime
# and swarm APIs; async ``stop`` does the same. Constructor-injected so tests
# can pass simple stubs without spinning up the real Exchange / swarm.
StartFn = Callable[[], None]
StopFn = Callable[[], Awaitable[None]]


class SimLifecycle:
    """Coordinates start/stop of the exchange tick loop and the agent swarm
    based on the count of active SSE viewers.

    Public lifecycle:

    * ``boot()`` — call from FastAPI startup. Idempotent on repeated calls.
    * ``shutdown()`` — call from FastAPI shutdown.
    * ``on_subscribe()`` / ``on_unsubscribe()`` — call from
      ``ExchangeRuntime._subscribe`` / ``_unsubscribe``.
    """

    def __init__(
        self,
        *,
        start_exchange: StartFn,
        stop_exchange: StopFn,
        start_swarm: StartFn,
        stop_swarm: StopFn,
        grace_s: float | None = None,
        enabled: bool | None = None,
    ) -> None:
        self._start_exchange = start_exchange
        self._stop_exchange = stop_exchange
        self._start_swarm = start_swarm
        self._stop_swarm = stop_swarm
        self._grace_s = grace_s if grace_s is not None else _read_grace_s()
        self._enabled = enabled if enabled is not None else _read_enabled()
        self._viewers = 0
        self._running = False
        self._pause_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    # ---- introspection ----

    @property
    def viewers(self) -> int:
        return self._viewers

    @property
    def running(self) -> bool:
        return self._running

    @property
    def enabled(self) -> bool:
        return self._enabled

    @property
    def grace_s(self) -> float:
        return self._grace_s

    def status(self) -> dict[str, object]:
        """JSON-friendly snapshot for the debug endpoint."""
        return {
            "enabled": self._enabled,
            "running": self._running,
            "viewers": self._viewers,
            "grace_s": self._grace_s,
            "pause_pending": self._pause_task is not None
            and not self._pause_task.done(),
        }

    # ---- lifecycle ----

    async def boot(self) -> None:
        """Run on FastAPI startup.

        With auto-pause enabled, leaves the sim idle until the first viewer
        connects. With auto-pause disabled, starts immediately (legacy
        behaviour) so live demos and headless load tests work without a
        viewer attached.
        """
        if self._enabled:
            logger.info(
                "sim lifecycle: auto-pause enabled (grace=%.1fs) — booting paused",
                self._grace_s,
            )
            return
        async with self._lock:
            await self._resume_locked()
        logger.info("sim lifecycle: auto-pause disabled — booting running")

    async def shutdown(self) -> None:
        """Run on FastAPI shutdown. Cancels any pending pause and stops the sim."""
        await self._cancel_pending_pause()
        async with self._lock:
            await self._pause_locked()

    # ---- viewer hooks (called from ExchangeRuntime SSE subscribe/unsubscribe) ----

    def on_subscribe(self) -> None:
        """A new SSE subscriber arrived. Bump the count and resume if needed.

        Synchronous on purpose — this runs on the SSE handler's hot path. Any
        actual start work (which awaits ``swarm.start`` etc.) is dispatched to
        a background task.
        """
        self._viewers += 1
        # Cancel a pending pause synchronously — somebody is watching again.
        # The await of the cancelled task happens lazily; we don't need to
        # block the SSE handler for it.
        if self._pause_task is not None and not self._pause_task.done():
            self._pause_task.cancel()
        self._pause_task = None
        if self._enabled and not self._running:
            asyncio.create_task(self._resume_safe(), name="sim-lifecycle-resume")

    def on_unsubscribe(self) -> None:
        """An SSE subscriber went away. Schedule a pause if the count hit zero."""
        if self._viewers > 0:
            self._viewers -= 1
        if not self._enabled:
            return
        if self._viewers == 0 and self._running:
            # Schedule the delayed pause. If a new subscriber lands in the
            # grace window, ``on_subscribe`` cancels this task.
            self._pause_task = asyncio.create_task(
                self._delayed_pause(), name="sim-lifecycle-pause"
            )

    # ---- internals ----

    async def _delayed_pause(self) -> None:
        try:
            await asyncio.sleep(self._grace_s)
        except asyncio.CancelledError:
            return
        async with self._lock:
            # Re-check under the lock: a viewer could have arrived between
            # the sleep ending and us acquiring the lock.
            if self._viewers == 0 and self._running:
                await self._pause_locked()

    async def _resume_safe(self) -> None:
        async with self._lock:
            if not self._running:
                await self._resume_locked()

    async def _resume_locked(self) -> None:
        if self._running:
            return
        # Start the exchange tick loop first so the swarm doesn't submit into
        # a stale ladder snapshot. Both .start() are sync — the awaits are on
        # cleanup paths only.
        self._start_exchange()
        self._start_swarm()
        self._running = True
        logger.info("sim resumed (viewers=%d)", self._viewers)

    async def _pause_locked(self) -> None:
        if not self._running:
            return
        # Stop the swarm first so agents stop submitting before the exchange
        # tears down its tick loop. Mirrors the order used in the FastAPI
        # lifespan shutdown path.
        await self._stop_swarm()
        await self._stop_exchange()
        self._running = False
        logger.info("sim paused (viewers=%d)", self._viewers)

    async def _cancel_pending_pause(self) -> None:
        task = self._pause_task
        self._pause_task = None
        if task is None or task.done():
            return
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


# Module-level singleton. Late-bound: ``configure()`` instantiates it from
# main.py during the FastAPI lifespan, before any SSE handler is reachable.
# The exchange_api debug endpoint reads it via ``get_lifecycle`` so feature
# code never touches the global directly.
_lifecycle: SimLifecycle | None = None


def configure(
    *,
    start_exchange: StartFn,
    stop_exchange: StopFn,
    start_swarm: StartFn,
    stop_swarm: StopFn,
) -> SimLifecycle:
    """Construct and register the process-wide lifecycle singleton.

    Idempotent — a second call returns the previously-constructed instance so
    a hot reload in tests doesn't double-wire callbacks onto the runtime.
    """
    global _lifecycle
    if _lifecycle is None:
        _lifecycle = SimLifecycle(
            start_exchange=start_exchange,
            stop_exchange=stop_exchange,
            start_swarm=start_swarm,
            stop_swarm=stop_swarm,
        )
    return _lifecycle


def get_lifecycle() -> SimLifecycle | None:
    """Return the configured singleton, or ``None`` if it hasn't been set up yet."""
    return _lifecycle
