from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator
import re

from app.models.website import WebsiteStatus


def _slug_or_none(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip().lower()
    if not re.match(r"^[a-z0-9_]+$", v):
        raise ValueError("Must be a valid slug (lowercase, digits, underscores only)")
    return v


# ── Create / Update ────────────────────────────────────────────────────────────

class WebsiteCreate(BaseModel):
    name: str
    url: str
    short_description: str
    full_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    logo_url: Optional[str] = None
    category_slug: Optional[str] = None   # e.g. "technology"
    domain_slug: Optional[str] = None     # e.g. "car_rental"
    tags: Optional[str] = None            # comma-separated keywords
    contact_email: Optional[str] = None
    phone_number: Optional[str] = None
    social_links: Optional[str] = None    # JSON string

    @field_validator("category_slug", "domain_slug", mode="before")
    @classmethod
    def normalise_slug(cls, v):
        return _slug_or_none(v)


class WebsiteUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    logo_url: Optional[str] = None
    category_slug: Optional[str] = None
    domain_slug: Optional[str] = None
    tags: Optional[str] = None
    contact_email: Optional[str] = None
    phone_number: Optional[str] = None
    social_links: Optional[str] = None

    @field_validator("category_slug", "domain_slug", mode="before")
    @classmethod
    def normalise_slug(cls, v):
        return _slug_or_none(v)


class WebsiteAdminUpdate(BaseModel):
    """Admin-only flag toggles."""
    is_premiered: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None


class ApproveWebsite(BaseModel):
    pass


class RejectWebsite(BaseModel):
    rejection_message: str


# ── Output ─────────────────────────────────────────────────────────────────────

class WebsiteOwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: Optional[str] = None
    email: str
    avatar_url: Optional[str] = None


class WebsiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    name: str
    url: str
    short_description: str
    full_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    logo_url: Optional[str] = None
    category_slug: Optional[str] = None
    domain_slug: Optional[str] = None
    tags: Optional[str] = None
    contact_email: Optional[str] = None
    phone_number: Optional[str] = None
    social_links: Optional[str] = None
    status: WebsiteStatus
    is_active: bool
    is_verified: bool
    is_premiered: bool
    total_clicks: int
    avg_rating: float
    review_count: int
    created_at: datetime
    updated_at: datetime


class WebsiteDetailOut(WebsiteOut):
    """Full detail — includes owner snippet and rejection message."""
    owner: WebsiteOwnerOut
    rejection_message: Optional[str] = None


class WebsitePendingOut(WebsiteOut):
    """Admin approval queue — includes owner info."""
    owner: WebsiteOwnerOut


class WebsiteStatSummary(BaseModel):
    """Summary card for client dashboard."""
    website_id: str
    website_name: str
    total_clicks: int
    clicks_today: int
    clicks_this_week: int
    clicks_this_month: int


# ── Discovery query response shapes ───────────────────────────────────────────

class TopNResponse(BaseModel):
    limit: int
    sort_by: str
    total_found: int
    items: List[WebsiteOut]


class CategoryBlockItem(BaseModel):
    """One section in a multi-category response."""
    category_slug: str
    items: List[WebsiteOut]


class MultiCategoryResponse(BaseModel):
    """Home-page feed: one block per requested category."""
    per_category: int
    blocks: List[CategoryBlockItem]
