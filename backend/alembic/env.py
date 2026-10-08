from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig
from uuid import uuid4

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# ── Load app config and models ────────────────────────────────────────────────
from app.core.config import settings
from app.core.database import Base

import app.models  # noqa: F401 — triggers __init__.py which imports all models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


_migration_url: str = os.environ.get("ALEMBIC_DATABASE_URL") or settings.DATABASE_URL

_is_sqlite  = _migration_url.startswith("sqlite")
_is_asyncpg = "asyncpg" in _migration_url
_is_pooler  = ":6543/" in _migration_url


def _make_migration_engine():
    """Build an async engine suitable for running Alembic migrations."""
    url = _migration_url.split("?")[0]  # strip any query params

    if _is_sqlite:
        return create_async_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=pool.NullPool,
        )

    _no_ps_args = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    }

    if _is_pooler:
        # Transaction pooler (Supabase port 6543 / PgBouncer): no SSL needed,
        # NullPool so each migration gets a fresh connection.
        return create_async_engine(
            url,
            poolclass=pool.NullPool,
            connect_args=_no_ps_args,
        )

    # Direct Postgres (port 5432) — standard SSL connection.
    return create_async_engine(
        url,
        poolclass=pool.NullPool,
        connect_args={"ssl": "require", **_no_ps_args},
    )


# ── Offline mode ──────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    context.configure(
        url=_migration_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode ───────────────────────────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = _make_migration_engine()
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
