from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_is_sqlite   = settings.DATABASE_URL.startswith("sqlite")
_is_postgres = settings.DATABASE_URL.startswith("postgresql")

_engine_kwargs: dict = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

elif _is_postgres:
    _using_pooler = ":6543/" in settings.DATABASE_URL

    if _using_pooler:
        _engine_kwargs["pool_size"]    = 1
        _engine_kwargs["max_overflow"] = 0
        _engine_kwargs["connect_args"] = {"statement_cache_size": 0}
    else:
        _engine_kwargs["pool_size"]    = settings.DB_POOL_SIZE
        _engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
        _engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
        _engine_kwargs["connect_args"] = {"ssl": "require"}

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """All models inherit from this."""
    pass


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
