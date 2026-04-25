# Backend agent guide

Read this before touching anything in `backend/`. These rules keep observability,
schemas, and dependency management consistent across contributors (human + AI).

## 1. Observability is centralised — do not bypass it

All observability lives in `backend/observability.py`. It runs once on startup from
`main.py` and:

- Calls `logfire.configure(send_to_logfire="if-token-present", ...)` so traces are a
  no-op locally and ship to Logfire when `LOGFIRE_TOKEN` is set in the env.
- Bridges stdlib logging into Logfire via `LogfireLoggingHandler` on the root logger.
- Calls `logfire.instrument_pydantic()` and `logfire.instrument_pydantic_ai()` so all
  pydantic validations and pydantic-ai agent runs are auto-traced.
- Auto-instruments FastAPI requests via `instrument_app(app)`.

### Do

- Use the stdlib logger pattern at the top of every module:

  ```python
  import logging

  logger = logging.getLogger(__name__)
  ```

- Then call `logger.info(...)`, `logger.warning(...)`, `logger.exception(...)`
  exactly as you would normally. The Logfire handler picks them up automatically.
- For span-style tracing (timing a block, grouping work), import logfire **directly
  in the module that needs the span**:

  ```python
  import logfire

  with logfire.span("agent_decision_loop", agent_id=persona.agent_id):
      ...
  ```

- If you add a new long-lived background task (similar to `runtime._run`), wrap its
  body in a `logfire.span` so it shows up as a parent in the trace tree.

### Do NOT

- Do **not** call `logfire.configure()` again from anywhere else. It is idempotent
  but obscures where configuration actually happens.
- Do **not** call `logging.basicConfig(...)`. The handler is attached in
  `configure_observability()`; a second `basicConfig` call would clobber it.
- Do **not** create a custom logger formatter or hand-roll a stdout sink. Logfire's
  console output is the project default.
- Do **not** `print(...)` for diagnostics. Use the logger.

## 2. Error handling — always log, never swallow

```python
try:
    do_thing()
except SomeError:
    logger.exception("do_thing failed for agent_id=%s", agent_id)
    raise  # or return a typed error — never silent
```

`logger.exception(...)` (not `logger.error`) captures the traceback into the
Logfire span automatically. Bare `except: pass` is a hard no.

## 3. Trader-agent schemas live in `backend/agents/`

When wiring a new pydantic-ai agent, use the existing schemas — do not redefine them.

- `TraderPersona` — spawn-time config (archetype, cadence, risk, backstory).
- `TraderContext` — `deps_type` for the agent. Build it via
  `TraderContext.build(persona=..., observation=ex.observe(persona.agent_id), news=...)`.
- `TraderDecision` — `output_type` for the agent. Convert to the exchange's signed
  qty via `decision.to_signed_qty()` at the boundary, then submit via `Order(...)`.
- `NewsHeadline`, `MarketContextView`, `AccountView` — supporting views.

Skeleton for adding a real agent (do this, not a custom variant):

```python
import logfire
from pydantic_ai import Agent

from agents import TraderContext, TraderDecision

trader_agent = Agent(
    "anthropic/claude-sonnet-4.6",  # routes through Vercel AI Gateway
    deps_type=TraderContext,
    output_type=TraderDecision,
    instructions="...",
)

with logfire.span("trader_turn", agent_id=ctx.persona.agent_id):
    result = await trader_agent.run("What do you do?", deps=ctx)
    decision: TraderDecision = result.output
```

`instrument_pydantic_ai()` is already configured, so every `agent.run(...)` call is
traced (messages, tool calls, latency, token usage).

## 4. Engine vs schema boundary

- `backend/exchange/` uses `@dataclass(frozen=True)` types for hot-path performance.
  Keep them that way — do not convert them to pydantic models.
- `backend/agents/schemas.py` owns the LLM-facing boundary. Conversion helpers
  (`MarketContextView.from_snapshot`, `AccountView.from_snapshot`,
  `TradePrint.from_fill`) bridge the two worlds. Add new converters there, not in
  the engine.
- `backend/exchange_api.py` uses pydantic for HTTP request bodies only.

## 5. Dependencies — use `uv add`, never edit `pyproject.toml` directly

```bash
cd backend
uv add some-package           # runtime dep
uv add --dev some-package     # dev/test dep
```

This keeps `uv.lock` in sync. Do not paste a version string into `pyproject.toml`.

## 6. Lint + format before declaring done

```bash
cd backend
uv run ruff check .
uv run ruff format <files-you-touched>   # only files you edited
uv run pytest -q
```

Only format files you actually edited — there are pre-existing files with
unrelated formatting drift; do not include them in your diff.
