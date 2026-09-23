from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator
import re


def _validate_slug(v: str) -> str:
    """Slugs must be lowercase, alphanumeric + underscores only."""
    v = v.strip().lower()
    if not re.match(r"^[a-z0-9_]+$", v):
        raise ValueError("Slug must contain only lowercase letters, digits, and underscores")
    return v


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        return _validate_slug(v)


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ── Domain ────────────────────────────────────────────────────────────────────

class DomainCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0
    category_slug: Optional[str] = None   # optional parent category

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        return _validate_slug(v)


class DomainUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    category_slug: Optional[str] = None


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool
    sort_order: int
    category_slug: Optional[str] = None
    created_at: datetime
    updated_at: datetime
