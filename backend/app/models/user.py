from __future__ import annotations

from typing import List, Optional

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, ULIDPrimaryKey


class User(ULIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "users"

    # ── Identity ──────────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Auth ──────────────────────────────────────────────────────────────────
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)

    # ── Roles / status ────────────────────────────────────────────────────────
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    websites: Mapped[List["Website"]] = relationship(  # noqa: F821
        "Website", back_populates="owner", cascade="all, delete-orphan",
        foreign_keys="Website.owner_id",
    )
    reviews: Mapped[List["Review"]] = relationship(  # noqa: F821
        "Review", back_populates="author", cascade="all, delete-orphan",
    )
    notifications: Mapped[List["Notification"]] = relationship(  # noqa: F821
        "Notification", back_populates="user", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
