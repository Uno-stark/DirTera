from __future__ import annotations

import enum
from typing import List, Optional

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, ULIDPrimaryKey


class WebsiteStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class Website(ULIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "websites"

    # ── Ownership ─────────────────────────────────────────────────────────────
    owner_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── Basic info ────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    short_description: Mapped[str] = mapped_column(String(500), nullable=False)
    full_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Classification — DB-managed slugs ─────────────────────────────────────
    # Soft FK: references categories.slug / domains.slug but no DB-level
    # constraint so deleting a category does not cascade-break websites.
    # Validation enforced at service layer.
    category_slug: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    domain_slug: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    # Comma-separated free-text keywords for full-text search
    tags: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # ── Contact / social ──────────────────────────────────────────────────────
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # JSON string: {"twitter": "...", "facebook": "..."}
    social_links: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Status & moderation ───────────────────────────────────────────────────
    status: Mapped[WebsiteStatus] = mapped_column(
        Enum(WebsiteStatus), nullable=False, default=WebsiteStatus.PENDING, index=True
    )
    rejection_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[Optional[str]] = mapped_column(
        String(26), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # ── Visibility / features ─────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_premiered: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    # ── Subscription tracking ─────────────────────────────────────────────────
    linksset_subscription_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    # ── Denormalised aggregate stats (fast listing queries) ───────────────────
    total_clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    owner: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="websites", foreign_keys=[owner_id]
    )
    reviewed_by: Mapped[Optional["User"]] = relationship(  # noqa: F821
        "User", foreign_keys=[reviewed_by_id]
    )
    clicks: Mapped[List["ClickEvent"]] = relationship(  # noqa: F821
        "ClickEvent", back_populates="website", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[List["Subscription"]] = relationship(  # noqa: F821
        "Subscription", back_populates="website", cascade="all, delete-orphan"
    )
    reviews: Mapped[List["Review"]] = relationship(  # noqa: F821
        "Review", back_populates="website", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Website id={self.id} name={self.name} status={self.status}>"
