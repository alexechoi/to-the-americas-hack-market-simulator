import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# .env must load before observability so LOGFIRE_TOKEN / ENVIRONMENT are visible.
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

from agents import default_roster  # noqa: E402
from auth import FirebaseUser, OptionalFirebaseUser  # noqa: E402
from bootstrap import BootstrapError, bootstrap_from_yahoo  # noqa: E402
from debug_api import router as debug_router  # noqa: E402
from exchange_api import router as exchange_router  # noqa: E402
from firebase_service import auto_initialize  # noqa: E402
from news_api import router as news_router  # noqa: E402
from notifications import router as notifications_router  # noqa: E402
from observability import configure_observability, instrument_app  # noqa: E402
from runtime import runtime as exchange_runtime  # noqa: E402
from swarm import agent_swarm  # noqa: E402
from yahoo_finance_api import router as yahoo_router  # noqa: E402

logger = logging.getLogger(__name__)

# The cold-start ticker. Override via the ``BOOTSTRAP_TICKER`` env var (useful
# for demos or when Yahoo is down for a specific symbol and you want a cleaner
# fallback symbol). Any user-driven change mid-session goes through
# ``POST /exchange/spawn``, which bypasses this.
DEFAULT_BOOTSTRAP_TICKER = "NVDA"

configure_observability()

auto_initialize()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start/stop the exchange tick loop and the agent swarm alongside the app.

    Bootstrap order:
        1. Register the default roster on the swarm (personas only — no tasks yet).
        2. Try to hydrate the runtime from Yahoo Finance for ``BOOTSTRAP_TICKER``
           (defaults to NVDA). This swaps in a fresh Exchange seeded at the live
           spot price, plus a few recent headlines on the news bus.
        3. If Yahoo is unreachable or returns nothing usable, log a warning and
           keep the runtime's default cold-start state (fair=100.0, ticker=NVDA,
           no seed news) so the backend always boots.
        4. Start the exchange tick loop and the swarm task fleet.
    """
    # Register personas first so `runtime.respawn` can re-register them on the
    # fresh exchange instance it creates.
    for persona in default_roster():
        agent_swarm.register(persona)

    bootstrap_ticker = (
        os.getenv("BOOTSTRAP_TICKER", DEFAULT_BOOTSTRAP_TICKER).strip()
        or DEFAULT_BOOTSTRAP_TICKER
    )
    try:
        payload = await bootstrap_from_yahoo(bootstrap_ticker)
        await exchange_runtime.respawn(payload, personas=agent_swarm.list_personas())
    except BootstrapError as exc:
        # Yahoo may be slow or the symbol temporarily unresolvable — never
        # crash cold start on that. The runtime keeps its NVDA/$100 default
        # and the user can re-spawn via the HTTP endpoint once Yahoo is up.
        logger.warning(
            "bootstrap failed ticker=%s err=%s — falling back to cold-start defaults",
            bootstrap_ticker,
            exc,
        )

    exchange_runtime.start()
    agent_swarm.start()
    try:
        yield
    finally:
        # Stop the swarm first so agents stop submitting before the exchange tears down.
        await agent_swarm.stop()
        await exchange_runtime.stop()


app = FastAPI(
    title="Backend API",
    description="Backend API with Firebase authentication",
    version="0.1.0",
    lifespan=lifespan,
)
instrument_app(app)

# CORS configuration
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:8081",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(notifications_router)
app.include_router(exchange_router)
app.include_router(news_router)
app.include_router(debug_router)
app.include_router(yahoo_router)


# ============================================================================
# Public Routes (no authentication required)
# ============================================================================


@app.get("/")
def root():
    """Public root endpoint."""
    return {"message": "Hello from backend!"}


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


# ============================================================================
# Protected Routes (authentication required)
# ============================================================================


@app.get("/me")
async def get_current_user(user: FirebaseUser):
    """
    Get the current authenticated user's info.

    Requires a valid Firebase ID token in the Authorization header.
    """
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "email_verified": user.get("email_verified"),
        "name": user.get("name"),
        "picture": user.get("picture"),
    }


@app.get("/protected")
async def protected_route(user: FirebaseUser):
    """
    Example protected route that requires authentication.

    Requires a valid Firebase ID token in the Authorization header.
    """
    return {
        "message": f"Hello, {user.get('name') or user.get('email') or 'user'}!",
        "user_id": user.get("uid"),
    }


# ============================================================================
# Optional Auth Routes (works with or without authentication)
# ============================================================================


@app.get("/greeting")
async def greeting(user: OptionalFirebaseUser):
    """
    Example route with optional authentication.

    Returns a personalized greeting if authenticated, otherwise a generic one.
    """
    if user:
        name = user.get("name") or user.get("email") or "user"
        return {"message": f"Welcome back, {name}!"}
    return {"message": "Hello, guest!"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
