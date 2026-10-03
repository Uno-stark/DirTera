"""
Rate limiter — powered by slowapi (Starlette/FastAPI).
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def _get_client_ip(request) -> str:

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)


def _make_limiter() -> Limiter:
    if settings.REDIS_URL:
        storage_uri = settings.REDIS_URL
    else:
        storage_uri = "memory://"

    return Limiter(
        key_func=_get_client_ip,
        default_limits=[settings.RATE_LIMIT_GLOBAL],
        storage_uri=storage_uri,
        # Return 429 with a JSON body instead of plain text
        headers_enabled=True,   
        swallow_errors=False,
    )

limiter: Limiter = _make_limiter()
