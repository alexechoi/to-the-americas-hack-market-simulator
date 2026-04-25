import os
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# .env must load before observability so LOGFIRE_TOKEN / ENVIRONMENT are visible.
load_dotenv()

from auth import FirebaseUser, OptionalFirebaseUser  # noqa: E402
from exchange_api import router as exchange_router  # noqa: E402
from firebase_service import auto_initialize  # noqa: E402
from notifications import router as notifications_router  # noqa: E402
from observability import configure_observability, instrument_app  # noqa: E402
from runtime import runtime as exchange_runtime  # noqa: E402

configure_observability()

auto_initialize()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start/stop the exchange tick loop alongside the app."""
    exchange_runtime.start()
    try:
        yield
    finally:
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
