from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, ULIDPrimaryKey


class Category(ULIDPrimaryKey, TimestampMixin, Base):
    """
    Broad top-level category bucket.
    e.g. technology, health, finance, education …
    """
    __tablename__ = "categories"

    slug: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # e.g. emoji or icon key
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # display order on the frontend (lower = first)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<Category slug={self.slug}>"


class Domain(ULIDPrimaryKey, TimestampMixin, Base):
    """
    Industry / speciality domain — finer-grained than category.
    e.g. car_rental, clinic, law, resort, banking …
    """
    __tablename__ = "domains"

    slug: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    # Optional: group domains under a parent category
    category_slug: Mapped[Optional[str]] = mapped_column(
        String(100),
        ForeignKey("categories.slug", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<Domain slug={self.slug}>"
