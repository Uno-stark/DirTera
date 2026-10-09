from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import delete

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.limiter import limiter
from app.models.token_blocklist import TokenBlocklist
from app.services.image_service import close_http_client, init_http_client


# ── Blocklist cleanup ─────────────────────────────────────────────────────────

async def _purge_expired_tokens() -> None:
    """Delete blocklist rows whose token has already expired.
    """
    while True:
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(
                    delete(TokenBlocklist).where(
                        TokenBlocklist.expires_at < datetime.now(timezone.utc)
                    )
                )
                await session.commit()
        except Exception:
            pass  # never crash the server over a cleanup task
        await asyncio.sleep(3600)   # repeat every hour


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background cleanup task for expired blocklist tokens
    cleanup_task = asyncio.create_task(_purge_expired_tokens())

    # Initialise the shared httpx client (connection pool for Supabase Storage)
    init_http_client()

    if settings.CACHE_BACKEND == "redis":
        # Import lazily so the `redis` package is not required when using
        # the in-memory backend.
        from fastapi_cache.backends.redis import RedisBackend
        from redis import asyncio as aioredis

        if not settings.REDIS_URL:
            raise RuntimeError(
                "REDIS_URL must be set when CACHE_BACKEND is 'redis'"
            )
        redis_client = aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=False
        )
        FastAPICache.init(RedisBackend(redis_client), prefix="dirterra-cache")

        # Pre-warm the shared Redis client used for token blocklist checks in
        # deps.py, so the first authenticated request doesn't pay the connect cost.
        from app.core import deps as _deps
        await _deps._get_redis()
    else:
        FastAPICache.init(InMemoryBackend(), prefix="dirterra-cache")

    yield

    # ── Graceful shutdown ─────────────────────────────────────────────────────
    # Close the shared httpx connection pool
    await close_http_client()

    # Cancel the cleanup loop
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "DirTera — Modern Ethiopian Web Directory API. "
            "Register, discover, and manage Ethiopian websites."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── Rate limiter ──────────────────────────────────────────────────────────
    if settings.RATE_LIMIT_ENABLED:
        app.state.limiter = limiter
        app.add_middleware(SlowAPIMiddleware)

        @app.exception_handler(RateLimitExceeded)
        async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
            return JSONResponse(
                status_code=429,
                content={
                    "detail": (
                        f"Too many requests. "
                        f"Limit: {exc.limit.limit}. "
                        f"Please wait before retrying."
                    )
                },
                headers={
                    "Retry-After": (
                        str(exc.limit.reset_at)
                        if hasattr(exc.limit, "reset_at")
                        else "60"
                    ),
                },
            )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if not settings.DEBUG:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"],
        )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_router)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"], include_in_schema=False)
    async def health():
        return {"status": "ok", "version": settings.APP_VERSION}

        # ── React/Vite frontend ──────────────────────────────────────────────────────
    frontend_dist = (
        Path(__file__).resolve().parents[2] / "frontend" / "dist"
    )

    if frontend_dist.exists():

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(full_path: str):
            # Never let the SPA fallback swallow unknown API requests.
            if full_path.startswith("api/"):
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Not Found"},
                )

            requested_file = frontend_dist / full_path

            if requested_file.is_file():
                return FileResponse(requested_file)

            # React Router fallback:
            # /login, /dashboard, /admin, etc. all receive index.html.
            return FileResponse(frontend_dist / "index.html")


    return app


app = create_app()