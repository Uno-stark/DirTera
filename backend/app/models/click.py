from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import ULIDPrimaryKey


class ClickEvent(ULIDPrimaryKey, Base):
    __tablename__ = "click_events"

    website_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── Anonymised visitor metadata (no PII stored) ───────────────────────────
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)   # SHA-256 of IP
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    referrer: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    country_code: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)

    clicked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    website: Mapped["Website"] = relationship("Website", back_populates="clicks")  # noqa: F821

    def __repr__(self) -> str:
        return f"<ClickEvent id={self.id} website_id={self.website_id}>"
