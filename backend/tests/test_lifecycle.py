"""SimLifecycle: viewer-driven auto-pause controller.

These tests exercise the controller against simple stub callbacks rather than
the real ExchangeRuntime + AgentSwarm — that way we can verify the timing /
ref-counting logic without spinning up the LLM stack or the tick loop.

A separate ``test_lifecycle_runtime_integration`` exercises the
``ExchangeRuntime`` ↔ lifecycle wiring (subscribe / unsubscribe hooks) end to
end.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from lifecycle import SimLifecycle
from runtime import ExchangeRuntime


@dataclass
class StubTarget:
    """Records start/stop calls for a single managed component."""

    starts: int = 0
    stops: int = 0
    started: bool = False
    log: list[str] = field(default_factory=list)

    def start(self) -> None:
        self.starts += 1
        self.started = True
        self.log.append("start")

    async def stop(self) -> None:
        self.stops += 1
        self.started = False
        self.log.append("stop")


def _make_lifecycle(
    *, grace_s: float = 0.05, enabled: bool = True
) -> tuple[SimLifecycle, StubTarget, StubTarget]:
    exchange = StubTarget()
    swarm = StubTarget()
    lc = SimLifecycle(
        start_exchange=exchange.start,
        stop_exchange=exchange.stop,
        start_swarm=swarm.start,
        stop_swarm=swarm.stop,
        grace_s=grace_s,
        enabled=enabled,
    )
    return lc, exchange, swarm


# ---- boot ----


async def test_boot_paused_when_enabled():
    lc, exchange, swarm = _make_lifecycle(enabled=True)
    await lc.boot()
    assert lc.running is False
    assert exchange.starts == 0
    assert swarm.starts == 0


async def test_boot_running_when_disabled():
    lc, exchange, swarm = _make_lifecycle(enabled=False)
    await lc.boot()
    assert lc.running is True
    assert exchange.starts == 1
    assert swarm.starts == 1


# ---- subscribe / resume ----


async def test_first_subscribe_resumes_when_enabled():
    lc, exchange, swarm = _make_lifecycle(enabled=True)
    await lc.boot()

    lc.on_subscribe()
    # Resume is dispatched as a background task — yield until it completes.
    for _ in range(10):
        if lc.running:
            break
        await asyncio.sleep(0)
    assert lc.running is True
    assert lc.viewers == 1
    assert exchange.starts == 1
    assert swarm.starts == 1


async def test_extra_subscribers_dont_double_start():
    lc, exchange, swarm = _make_lifecycle(enabled=True)
    await lc.boot()

    lc.on_subscribe()
    lc.on_subscribe()
    lc.on_subscribe()
    for _ in range(10):
        if lc.running:
            break
        await asyncio.sleep(0)

    assert lc.viewers == 3
    # Only one start call regardless of how many subscribers piled in before
    # the resume task finished.
    assert exchange.starts == 1
    assert swarm.starts == 1


async def test_subscribe_when_disabled_does_not_change_running_state():
    """Disabled mode means lifecycle isn't allowed to flip the sim — even
    though it still ref-counts so ``status()`` is informative."""
    lc, exchange, swarm = _make_lifecycle(enabled=False)
    # Don't call boot — exercise pure subscribe behaviour.
    lc.on_subscribe()
    await asyncio.sleep(0)

    assert lc.viewers == 1
    assert lc.running is False
    assert exchange.starts == 0
    assert swarm.starts == 0


# ---- unsubscribe / pause ----


async def test_unsubscribe_pauses_after_grace():
    lc, exchange, swarm = _make_lifecycle(grace_s=0.05, enabled=True)
    await lc.boot()
    lc.on_subscribe()
    for _ in range(10):
        if lc.running:
            break
        await asyncio.sleep(0)
    assert lc.running is True

    lc.on_unsubscribe()
    assert lc.viewers == 0
    # Pause should not have fired yet.
    await asyncio.sleep(0.01)
    assert lc.running is True
    # Wait past the grace window.
    await asyncio.sleep(0.1)
    assert lc.running is False
    assert swarm.stops == 1
    assert exchange.stops == 1
    # Stop ordering: swarm stops before exchange so agents stop submitting
    # before the tick loop tears down.
    assert swarm.log == ["start", "stop"]
    assert exchange.log == ["start", "stop"]


async def test_reconnect_within_grace_cancels_pending_pause():
    lc, exchange, swarm = _make_lifecycle(grace_s=0.1, enabled=True)
    await lc.boot()
    lc.on_subscribe()
    for _ in range(10):
        if lc.running:
            break
        await asyncio.sleep(0)

    lc.on_unsubscribe()
    # Reconnect well inside the grace window.
    await asyncio.sleep(0.02)
    lc.on_subscribe()
    # Wait past the original grace window — sim must NOT pause because the
    # cancel cleared the pending task.
    await asyncio.sleep(0.15)

    assert lc.running is True
    # Should still be the original start, no extra start/stop cycles.
    assert exchange.starts == 1
    assert exchange.stops == 0
    assert swarm.starts == 1
    assert swarm.stops == 0


async def test_multiple_subscribers_no_pause_until_all_leave():
    lc, exchange, swarm = _make_lifecycle(grace_s=0.05, enabled=True)
    await lc.boot()
    lc.on_subscribe()
    lc.on_subscribe()
    for _ in range(10):
        if lc.running:
            break
        await asyncio.sleep(0)

    lc.on_unsubscribe()
    # Still one viewer — must not even schedule a pause.
    await asyncio.sleep(0.1)
    assert lc.running is True
    assert lc.viewers == 1

    lc.on_unsubscribe()
    await asyncio.sleep(0.1)
    assert lc.running is False
    assert lc.viewers == 0


async def test_unsubscribe_when_disabled_does_not_pause():
    lc, exchange, swarm = _make_lifecycle(grace_s=0.05, enabled=False)
    await lc.boot()
    assert lc.running is True

    lc.on_subscribe()
    lc.on_unsubscribe()
    await asyncio.sleep(0.1)

    # Disabled lifecycle never tears down the sim on viewer churn.
    assert lc.running is True
    assert exchange.stops == 0
    assert swarm.stops == 0


# ---- shutdown ----


async def test_shutdown_cancels_pending_pause_and_stops():
    lc, exchange, swarm = _make_lifecycle(grace_s=10.0, enabled=True)
    await lc.boot()
    lc.on_subscribe()
    for _ in range(10):
        if lc.running:
            break
        await asyncio.sleep(0)
    lc.on_unsubscribe()
    # Pause is pending but nowhere near firing.
    assert lc.running is True

    await lc.shutdown()
    # After shutdown the sim is stopped.
    assert lc.running is False
    assert exchange.stops == 1
    assert swarm.stops == 1


async def test_status_payload_shape():
    lc, _, _ = _make_lifecycle(grace_s=0.5, enabled=True)
    await lc.boot()

    status = lc.status()
    assert status == {
        "enabled": True,
        "running": False,
        "viewers": 0,
        "grace_s": 0.5,
        "pause_pending": False,
    }


# ---- ExchangeRuntime ↔ lifecycle wiring ----


async def test_exchange_runtime_fires_viewer_hooks():
    """End-to-end check: subscribing to the runtime fires on_subscribe, and
    the SSE generator's teardown fires on_unsubscribe."""
    rt = ExchangeRuntime()
    counts = {"subs": 0, "unsubs": 0}

    rt.set_viewer_hooks(
        on_subscribe=lambda: counts.__setitem__("subs", counts["subs"] + 1),
        on_unsubscribe=lambda: counts.__setitem__("unsubs", counts["unsubs"] + 1),
    )

    # Manual subscribe path (mirrors what stream() does internally).
    q = rt._subscribe()
    assert counts == {"subs": 1, "unsubs": 0}
    rt._unsubscribe(q)
    assert counts == {"subs": 1, "unsubs": 1}


async def test_exchange_runtime_clears_hooks():
    """``set_viewer_hooks(on_subscribe=None, on_unsubscribe=None)`` detaches
    the lifecycle so a subsequent shutdown can't re-enter it."""
    rt = ExchangeRuntime()
    counts = {"subs": 0, "unsubs": 0}

    rt.set_viewer_hooks(
        on_subscribe=lambda: counts.__setitem__("subs", counts["subs"] + 1),
        on_unsubscribe=lambda: counts.__setitem__("unsubs", counts["unsubs"] + 1),
    )
    rt.set_viewer_hooks(on_subscribe=None, on_unsubscribe=None)

    q = rt._subscribe()
    rt._unsubscribe(q)
    assert counts == {"subs": 0, "unsubs": 0}


async def test_subscribe_hook_failure_does_not_break_subscription():
    """A buggy hook callback must never break the SSE handshake — the
    subscription still succeeds and the queue is primed normally."""
    rt = ExchangeRuntime()

    def bad_hook() -> None:
        raise RuntimeError("boom")

    rt.set_viewer_hooks(on_subscribe=bad_hook, on_unsubscribe=bad_hook)

    q = rt._subscribe()
    # Queue still primed with reset + snapshot envelopes despite the hook
    # exploding.
    assert q.qsize() >= 2
    rt._unsubscribe(q)


async def test_lifecycle_resumes_via_real_runtime_subscribe():
    """End-to-end: lifecycle sees a real ExchangeRuntime subscribe and
    flips to running."""
    rt = ExchangeRuntime()
    swarm = StubTarget()
    lc = SimLifecycle(
        start_exchange=rt.start,
        stop_exchange=rt.stop,
        start_swarm=swarm.start,
        stop_swarm=swarm.stop,
        grace_s=0.05,
        enabled=True,
    )
    rt.set_viewer_hooks(on_subscribe=lc.on_subscribe, on_unsubscribe=lc.on_unsubscribe)
    await lc.boot()
    assert lc.running is False

    q = rt._subscribe()
    try:
        for _ in range(10):
            if lc.running:
                break
            await asyncio.sleep(0)
        assert lc.running is True
        assert rt._task is not None and not rt._task.done()
        assert swarm.starts == 1
    finally:
        rt._unsubscribe(q)
        # Wait past the grace window.
        await asyncio.sleep(0.1)
        # Cleanup so we don't leak the tick task between tests.
        await lc.shutdown()
        rt.set_viewer_hooks(on_subscribe=None, on_unsubscribe=None)
