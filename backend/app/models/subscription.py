from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, ULIDPrimaryKey


class SubscriptionPlan(str, enum.Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"
    PREMIERED = "premiered"  # to appeared in premiered section


class SubscriptionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    FAILED = "failed"


class Subscription(ULIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    website_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── Plan details ──────────────────────────────────────────────────────────
    plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan), nullable=False, default=SubscriptionPlan.BASIC
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="ETB", nullable=False)

    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.PENDING, index=True
    )

    # ── links.et receipt reference ────────────────────────────────────────────
    # Only the receipt URL is stored — full receipt re-fetchable from links.et
    receipt_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True, unique=True)
    payment_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    receipt_no: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # ── Dates ─────────────────────────────────────────────────────────────────
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    website: Mapped["Website"] = relationship("Website", back_populates="subscriptions")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Subscription id={self.id} plan={self.plan} status={self.status}>"
