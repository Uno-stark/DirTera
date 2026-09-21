from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, ULIDPrimaryKey


class Review(ULIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "reviews"

    __table_args__ = (
        UniqueConstraint("author_id", "website_id", name="uq_review_author_website"),
    )

    author_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    website_id: Mapped[str] = mapped_column(
        String(26), ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True
    )

    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–5
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_visible: Mapped[bool] = mapped_column(default=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    author: Mapped["User"] = relationship("User", back_populates="reviews")  # noqa: F821
    website: Mapped["Website"] = relationship("Website", back_populates="reviews")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Review id={self.id} rating={self.rating}>"
