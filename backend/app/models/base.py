from __future__ import annotations

from datetime import datetime

import ulid as ulid_lib
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column


def new_ulid() -> str:
    """Generate a new ULID string. Used as the default factory for all PKs."""
    return str(ulid_lib.new())


class ULIDPrimaryKey:
    """
    Mixin that adds a ULID primary key column named `id`.
    Must appear before Base in the MRO:  class MyModel(ULIDPrimaryKey, TimestampMixin, Base)
    """
    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=new_ulid,
        nullable=False,
    )


class TimestampMixin:
    """Adds created_at / updated_at to any model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

