from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
import re

from app.models.website import WebsiteStatus


# Forward reference for ReviewOut - actual import happens after Review schema is loaded
TYPE_CHECKING = False
if TYPE_CHECKING:
    from app.schemas.review import ReviewOut


def _slug_or_none(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip().lower()
    if not re.match(r"^[a-z0-9_]+$", v):
        raise ValueError("Must be a valid slug (lowercase, digits, underscores only)")
    return v


def _split_image_urls(raw) -> List[str]:
    """
    Convert the stored comma-separated string to a clean list.
    Accepts str, list, or None — safe to call from a field_validator.
    """
    if not raw:
        return []
    if isinstance(raw, list):
        return [u.strip() for u in raw if u and u.strip()]
    return [u.strip() for u in str(raw).split(",") if u.strip()]


# ── Create / Update ────────────────────────────────────────────────────────────

class WebsiteCreate(BaseModel):
    name: str
    url: str
    short_description: str
    full_description: Optional[str] = None
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


class WebsiteUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
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
    is_premiered: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None


class RejectWebsite(BaseModel):
    rejection_message: str


# ── Public output ──────────────────────────────────────────────────────────────

class WebsitePublicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    short_description: str
    full_description: Optional[str] = None
    logo_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    image_urls: List[str] = []
    category_slug: Optional[str] = None
    domain_slug: Optional[str] = None
    tags: Optional[str] = None
    is_verified: bool
    is_premiered: bool
    avg_rating: float
    review_count: int
    total_clicks: int
    created_at: datetime

    @field_validator("image_urls", mode="before")
    @classmethod
    def _parse_image_urls(cls, v):
        return _split_image_urls(v)

    @model_validator(mode="after")
    def _set_thumbnail_url(self) -> WebsitePublicOut:
        if not self.thumbnail_url and self.image_urls:
            self.thumbnail_url = self.image_urls[0]
        return self


class WebsitePublicDetailOut(WebsitePublicOut):
    
    contact_email: Optional[str] = None
    phone_number: Optional[str] = None
    social_links: Optional[str] = None
    owner_display_name: Optional[str] = None
    owner_avatar_url: Optional[str] = None


# ── Owner / Admin output ───────────────────────────────────────────────────────

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
    logo_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    image_urls: List[str] = []
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

    @field_validator("image_urls", mode="before")
    @classmethod
    def _parse_image_urls(cls, v):
        return _split_image_urls(v)

    @model_validator(mode="after")
    def _set_thumbnail_url(self) -> WebsiteOut:
        if not self.thumbnail_url and self.image_urls:
            self.thumbnail_url = self.image_urls[0]
        return self


class WebsiteDetailOut(WebsiteOut):
    owner: WebsiteOwnerOut
    rejection_message: Optional[str] = None


class WebsitePendingOut(WebsiteOut):
    owner: WebsiteOwnerOut
    reviews: Optional[List["ReviewOut"]] = None  # Include reviews for admin


class WebsiteStatSummary(BaseModel):
    website_id: str
    website_name: str
    total_clicks: int
    clicks_today: int
    clicks_this_week: int
    clicks_this_month: int


# ── Discovery response shapes ──────────────────────────────────────────────────

class TopNResponse(BaseModel):
    limit: int
    sort_by: str
    total_found: int
    items: List[WebsitePublicOut]


class CategoryBlockItem(BaseModel):
    category_slug: str
    items: List[WebsitePublicOut]


class MultiCategoryResponse(BaseModel):
    per_category: int
    blocks: List[CategoryBlockItem]


# ── Image upload response ──────────────────────────────────────────────────────

class ImageUploadResponse(BaseModel):
    slot: str
    url: str
    logo_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    image_urls: List[str] = []


# Resolve forward references after all models are defined
# This allows WebsitePendingOut to reference ReviewOut
def _resolve_forward_refs():
    """Import ReviewOut and rebuild models to resolve forward references."""
    try:
        from app.schemas.review import ReviewOut
        WebsitePendingOut.model_rebuild()
    except ImportError:
        pass  # ReviewOut may not be available in all contexts


_resolve_forward_refs()
