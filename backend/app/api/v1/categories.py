"""
Category and Domain taxonomy endpoints.

─── Public (no auth required) ────────────────────────────────────────────────
GET  /categories             → list all active categories
GET  /categories/{slug}      → get one category
GET  /domains                → list all active domains (optionally filter by category)
GET  /domains/{slug}         → get one domain

─── Admin only ────────────────────────────────────────────────────────────────
POST   /categories           → create category
PATCH  /categories/{slug}    → update category
DELETE /categories/{slug}    → soft-deactivate (or hard delete with ?hard=true)

POST   /domains              → create domain
PATCH  /domains/{slug}       → update domain
DELETE /domains/{slug}       → soft-deactivate (or hard delete with ?hard=true)
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query

from app.core.deps import AdminUser, DBSession
from app.schemas.category import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    DomainCreate,
    DomainOut,
    DomainUpdate,
)
from app.services import category_service

router = APIRouter(tags=["Taxonomy"])


# ══════════════════════════════════════════════════════════════════════════════
#  CATEGORIES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/categories", response_model=List[CategoryOut], summary="List categories")
async def list_categories(
    db: DBSession,
    active_only: bool = Query(True, description="Return only active categories"),
):
    """Public endpoint — returns the live category list the frontend uses to build filters."""
    return await category_service.list_categories(db, active_only)


@router.get("/categories/{slug}", response_model=CategoryOut, summary="Get one category")
async def get_category(slug: str, db: DBSession):
    return await category_service.get_category_by_slug(slug, db)


@router.post(
    "/categories",
    response_model=CategoryOut,
    status_code=201,
    summary="Create category (admin)",
)
async def create_category(
    payload: CategoryCreate, _admin: AdminUser, db: DBSession
):
    """
    Creates a new category. The `slug` must be unique and use only
    lowercase letters, digits, and underscores (e.g. `real_estate`).
    """
    return await category_service.create_category(payload, db)


@router.patch(
    "/categories/{slug}",
    response_model=CategoryOut,
    summary="Update category (admin)",
)
async def update_category(
    slug: str, payload: CategoryUpdate, _admin: AdminUser, db: DBSession
):
    return await category_service.update_category(slug, payload, db)


@router.delete(
    "/categories/{slug}",
    status_code=204,
    summary="Deactivate or delete category (admin)",
)
async def delete_category(
    slug: str,
    _admin: AdminUser,
    db: DBSession,
    hard: bool = Query(
        False,
        description="true = hard delete row from DB. "
                    "false (default) = soft-deactivate (sets is_active=false, "
                    "existing websites keep their slug reference).",
    ),
):
    if hard:
        await category_service.hard_delete_category(slug, db)
    else:
        await category_service.delete_category(slug, db)


# ══════════════════════════════════════════════════════════════════════════════
#  DOMAINS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/domains", response_model=List[DomainOut], summary="List domains")
async def list_domains(
    db: DBSession,
    active_only: bool = Query(True),
    category_slug: Optional[str] = Query(
        None, description="Filter domains that belong to a specific category"
    ),
):
    """
    Public endpoint.
    Pass `?category_slug=technology` to get only tech-related domains.
    """
    return await category_service.list_domains(db, active_only, category_slug)


@router.get("/domains/{slug}", response_model=DomainOut, summary="Get one domain")
async def get_domain(slug: str, db: DBSession):
    return await category_service.get_domain_by_slug(slug, db)


@router.post(
    "/domains",
    response_model=DomainOut,
    status_code=201,
    summary="Create domain (admin)",
)
async def create_domain(
    payload: DomainCreate, _admin: AdminUser, db: DBSession
):
    """
    Creates a new domain. Optionally assign it to a parent category via
    `category_slug` for grouped display in the frontend.
    """
    return await category_service.create_domain(payload, db)


@router.patch(
    "/domains/{slug}",
    response_model=DomainOut,
    summary="Update domain (admin)",
)
async def update_domain(
    slug: str, payload: DomainUpdate, _admin: AdminUser, db: DBSession
):
    return await category_service.update_domain(slug, payload, db)


@router.delete(
    "/domains/{slug}",
    status_code=204,
    summary="Deactivate or delete domain (admin)",
)
async def delete_domain(
    slug: str,
    _admin: AdminUser,
    db: DBSession,
    hard: bool = Query(False),
):
    if hard:
        await category_service.hard_delete_domain(slug, db)
    else:
        await category_service.delete_domain(slug, db)
