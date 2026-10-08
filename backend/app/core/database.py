from __future__ import annotations

from typing import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Supabase transaction pooler uses port 6543.
# PgBouncer in transaction/statement mode does not support prepared statements.
_using_pooler = (
    settings.DATABASE_URL.startswith("postgresql")
    and ":6543/" in settings.DATABASE_URL
)

def _strip_query(url: str) -> str:
    return url.split("?")[0]

if _is_sqlite:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

elif _using_pooler:

    engine = create_async_engine(
        _strip_query(settings.DATABASE_URL),
        echo=settings.DEBUG,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        },
    )

else:
    # ── Direct Postgres (no pooler) ───────────────────────────────────────────
    engine = create_async_engine(
        _strip_query(settings.DATABASE_URL),
        echo=settings.DEBUG,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=True,
        connect_args={"ssl": "require"},
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()