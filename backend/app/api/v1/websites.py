"""
Website listing endpoints.

─── Public discovery ──────────────────────────────────────────────────────────
GET  /websites                     → browse (category_slug, domain_slug, keywords, sort)
GET  /websites/top                 → top N sites (limit, sort)
GET  /websites/multi-category      → one block per category slug — home-page feed
GET  /websites/premiered           → premiered sites only
GET  /websites/{website_id}        → full listing detail
GET  /websites/{website_id}/click  → record click → redirect

─── Client (owner) ────────────────────────────────────────────────────────────
GET    /websites/my
POST   /websites
PATCH  /websites/{website_id}
DELETE /websites/{website_id}

─── Admin ─────────────────────────────────────────────────────────────────────
GET    /websites/admin/all
POST   /websites/{website_id}/approve
POST   /websites/{website_id}/reject
PATCH  /websites/{website_id}/admin
"""

from __future__ import annotations

import math
from typing import List, Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import RedirectResponse

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.models.website import WebsiteStatus
from app.schemas.common import PaginatedResponse
from app.schemas.website import (
    MultiCategoryResponse,
    RejectWebsite,
    TopNResponse,
    WebsiteAdminUpdate,
    WebsiteCreate,
    WebsiteDetailOut,
    WebsiteOut,
    WebsitePendingOut,
    WebsiteUpdate,
)
from app.services import analytics_service, website_service

router = APIRouter(prefix="/websites", tags=["Websites"])

_SORT_OPTIONS = ["score", "rating", "clicks", "newest"]


# ── Public discovery ────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[WebsiteOut], summary="Browse listings")
async def browse_websites(
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None, description="Category slug, e.g. 'technology'"),
    domain: Optional[str] = Query(None, description="Domain slug, e.g. 'car_rental'"),
    keywords: Optional[str] = Query(None, description="Comma-separated keywords"),
    sort_by: str = Query("score", description="score | rating | clicks | newest"),
):
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    items, total = await website_service.list_websites_public(
        db, page, page_size, category, domain, keywords, sort_by=sort_by
    )
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/top", response_model=TopNResponse, summary="Top N listings")
async def top_websites(
    db: DBSession,
    limit: int = Query(10, ge=1, le=50, description="Number to return (max 50)"),
    category: Optional[str] = Query(None, description="Category slug"),
    domain: Optional[str] = Query(None, description="Domain slug"),
    keywords: Optional[str] = Query(None),
    sort_by: str = Query("score"),
):
    """
    Top N websites — site-wide or scoped to category / domain / keywords.

    Examples:
    - `?domain=car_rental&limit=5`          → top 5 car rental sites
    - `?category=health&sort_by=rating`     → top health sites by rating
    - `?limit=10`                           → site-wide top 10
    """
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    return await website_service.get_top_n(db, limit, category, domain, keywords, sort_by)


@router.get(
    "/multi-category",
    response_model=MultiCategoryResponse,
    summary="Fetch top websites from multiple category slugs in one request",
)
async def multi_category(
    db: DBSession,
    categories: List[str] = Query(
        ...,
        description="Category slugs — repeat param: ?categories=technology&categories=health",
    ),
    per_category: int = Query(5, ge=1, le=20),
    domain: Optional[str] = Query(None),
    keywords: Optional[str] = Query(None),
    sort_by: str = Query("score"),
):
    """
    Returns one block per requested category slug, sorted by the chosen strategy.
    Designed for home-page feeds.  Max 10 categories × 20 items.
    """
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    return await website_service.get_multi_category(
        db, categories, per_category, sort_by, domain, keywords
    )


@router.get("/premiered", response_model=PaginatedResponse[WebsiteOut], summary="Premiered listings")
async def premiered_websites(
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("score"),
):
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    items, total = await website_service.list_websites_public(
        db, page, page_size, is_premiered=True, sort_by=sort_by
    )
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/my", response_model=PaginatedResponse[WebsiteOut], summary="My listings")
async def my_websites(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    items, total = await website_service.list_my_websites(current_user.id, db, page, page_size)
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get(
    "/admin/all",
    response_model=PaginatedResponse[WebsitePendingOut],
    summary="Admin: all listings",
)
async def admin_list_websites(
    _admin: AdminUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[WebsiteStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
):
    items, total = await website_service.list_websites_admin(
        db, page, page_size, status_filter, search, category, domain
    )
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/{website_id}", response_model=WebsiteDetailOut, summary="Get listing detail")
async def get_website(website_id: str, db: DBSession):
    return await website_service.get_website_by_id(website_id, db)


@router.get("/{website_id}/click", summary="Record click and redirect")
async def click_redirect(website_id: str, request: Request, db: DBSession):
    website = await website_service.get_website_by_id(website_id, db)
    await analytics_service.record_click(website, request, db)
    return RedirectResponse(url=website.url, status_code=302)


# ── Client (owner) ─────────────────────────────────────────────────────────────

@router.post("", response_model=WebsiteDetailOut, status_code=201)
async def register_website(payload: WebsiteCreate, current_user: CurrentUser, db: DBSession):
    website = await website_service.create_website(payload, current_user, db)
    return await website_service.get_website_by_id(website.id, db)


@router.patch("/{website_id}", response_model=WebsiteDetailOut)
async def update_website(
    website_id: str, payload: WebsiteUpdate, current_user: CurrentUser, db: DBSession
):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)
    updated = await website_service.update_website(website, payload, db)
    return await website_service.get_website_by_id(updated.id, db)


@router.delete("/{website_id}", status_code=204)
async def delete_website(website_id: str, current_user: CurrentUser, db: DBSession):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)
    await website_service.delete_website(website, db)


# ── Admin moderation ───────────────────────────────────────────────────────────

@router.post("/{website_id}/approve", response_model=WebsiteDetailOut)
async def approve_website(website_id: str, admin: AdminUser, db: DBSession):
    website = await website_service.approve_website(website_id, admin, db)
    return await website_service.get_website_by_id(website.id, db)


@router.post("/{website_id}/reject", response_model=WebsiteDetailOut)
async def reject_website(
    website_id: str, payload: RejectWebsite, admin: AdminUser, db: DBSession
):
    website = await website_service.reject_website(website_id, payload, admin, db)
    return await website_service.get_website_by_id(website.id, db)


@router.patch("/{website_id}/admin", response_model=WebsiteDetailOut)
async def admin_update_website(
    website_id: str, payload: WebsiteAdminUpdate, _admin: AdminUser, db: DBSession
):
    website = await website_service.admin_update_website(website_id, payload, db)
    return await website_service.get_website_by_id(website.id, db)
