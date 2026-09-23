from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────
_connect_args: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite needs check_same_thread disabled
    _connect_args = {"check_same_thread": False}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=_connect_args,
    # pool settings are ignored by SQLite but used by Postgres
    pool_size=settings.DB_POOL_SIZE if not settings.DATABASE_URL.startswith("sqlite") else 5,
    max_overflow=settings.DB_MAX_OVERFLOW if not settings.DATABASE_URL.startswith("sqlite") else 0,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Base ──────────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """All models inherit from this."""
    pass


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
