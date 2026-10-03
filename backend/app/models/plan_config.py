from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, ULIDPrimaryKey


class SubscriptionPlanConfig(ULIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "plan_configs"

    slug: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="ETB", nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Receiver identity ─────────────────────────────────────────────────────

    receiver_name: Mapped[str] = mapped_column(String(255), nullable=False)
    receiver_phone: Mapped[str] = mapped_column(String(50), nullable=False)

    # If True, activating a subscription for this plan sets is_premiered=True
    is_premiered: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<PlanConfig slug={self.slug} amount={self.amount}>"
