from __future__ import annotations

import time
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.token_blocklist import TokenBlocklist
from app.models.user import User

security = HTTPBearer()

# Global Redis client (initialised on first use, reset on failure)
_redis_client: Optional[any] = None
_redis_last_failed_at: float = 0.0          # epoch seconds of last connect failure
_REDIS_RETRY_COOLDOWN: float = 60.0         # seconds to wait before retrying after failure


async def _get_redis():
    """
    Get (or lazily create) the shared Redis client for blocklist caching.

    On connection failure the client is set to None and a timestamp is recorded.
    Reconnection is attempted after _REDIS_RETRY_COOLDOWN seconds, so a
    transient Redis outage doesn't permanently disable the cache for the
    lifetime of the process.
    """
    global _redis_client, _redis_last_failed_at

    # Already have a live client — return it immediately.
    if _redis_client is not None:
        return _redis_client

    if not settings.REDIS_URL:
        return None

    # Still within the cooldown window after a previous failure — skip retry.
    if _redis_last_failed_at and (time.monotonic() - _redis_last_failed_at) < _REDIS_RETRY_COOLDOWN:
        return None

    try:
        from redis import asyncio as aioredis
        client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
        )
        # Test the connection before committing to this client.
        await client.ping()
        _redis_client = client
        _redis_last_failed_at = 0.0          # clear failure timestamp on success
        return _redis_client
    except Exception:
        # Record failure time so we back off before the next attempt.
        _redis_last_failed_at = time.monotonic()
        _redis_client = None
        return None

def _reset_redis_client() -> None:
    """
    Force-reset the shared Redis client so _get_redis() will attempt a fresh
    connection on the next call.  Useful after a detected Redis failure or
    during test teardown.
    """
    global _redis_client, _redis_last_failed_at
    _redis_client = None
    _redis_last_failed_at = 0.0


async def _is_token_blocked(jti: str, db: AsyncSession) -> bool:
    """
    Check if a token is in the blocklist.
    Uses Redis cache if available, falls back to database.
    """
    if not jti:
        return False

    # Try Redis first (fast)
    redis = await _get_redis()
    if redis is not None:
        try:
            redis_key = f"blocklist:{jti}"
            cached = await redis.get(redis_key)
            if cached is not None:
                return cached == "1"

            # Not in cache - check database
            blocked = await db.execute(
                select(TokenBlocklist).where(TokenBlocklist.jti == jti)
            )
            is_blocked = blocked.scalar_one_or_none() is not None

            # Cache result (TTL = access token expiry + 1 hour buffer)
            ttl = (settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60) + 3600
            await redis.setex(redis_key, ttl, "1" if is_blocked else "0")

            return is_blocked
        except Exception:
            # Redis error — reset so the next request retries after the cooldown
            _reset_redis_client()
            # Fall through to database check

    # Fallback: direct database check (no Redis)
    blocked = await db.execute(
        select(TokenBlocklist).where(TokenBlocklist.jti == jti)
    )
    return blocked.scalar_one_or_none() is not None

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Extract and validate JWT token, check blocklist, and return the current user.
    Uses Redis for fast blocklist lookups when available.
    """
    token = credentials.credentials
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str = payload["sub"]
        jti: str = payload.get("jti", "")
        if not user_id:
            raise credentials_exc
    except (JWTError, KeyError):
        raise credentials_exc

    # ── Blocklist check with Redis caching ────────────────────────────────────
    if await _is_token_blocked(jti, db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── User lookup ───────────────────────────────────────────────────────────
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user

async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Ensure the current user has admin privileges."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user

# Convenience type aliases
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
