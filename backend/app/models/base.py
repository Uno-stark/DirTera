import enum
from datetime import datetime
from typing import Any

from ulid import ULID
from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column


class PgEnum(Enum):
    """
    SQLAlchemy Enum subclass that:
    1. Uses enum values instead of member names for queries and inserts.
    2. Defaults the PostgreSQL enum type name to the lowercase class name.
    """

    def __init__(self, enum_type: type[enum.Enum], **kw: Any) -> None:
        kw.setdefault("name", enum_type.__name__.lower())
        kw.setdefault("values_callable", lambda obj: [e.value for e in obj])
        super().__init__(enum_type, **kw)


def new_ulid() -> str:
    """Generate a new ULID string. Used as the default factory for all PKs."""
    return str(ULID())


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

