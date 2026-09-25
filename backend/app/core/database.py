from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

_is_sqlite    = settings.DATABASE_URL.startswith("sqlite")
_using_pooler = (
    settings.DATABASE_URL.startswith("postgresql")
    and ":6543/" in settings.DATABASE_URL
)

if _is_sqlite:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

elif _using_pooler:
    # Supabase transaction pooler via psycopg3 (no prepared statement issues)
    # Swap asyncpg driver for psycopg in the URL
    psycopg_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://"
    ).split("?")[0]

    engine = create_async_engine(
        psycopg_url,
        echo=settings.DEBUG,
        poolclass=NullPool,
    )
else:
    # Direct Postgres — asyncpg with SSL
    engine = create_async_engine(
        settings.DATABASE_URL.split("?")[0],
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