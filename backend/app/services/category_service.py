from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, Domain
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    DomainCreate,
    DomainUpdate,
)

# ── Category ──────────────────────────────────────────────────────────────────

async def list_categories(
    db: AsyncSession,
    active_only: bool = True,
) -> List[Category]:
    query = select(Category).order_by(Category.sort_order, Category.name)
    if active_only:
        query = query.where(Category.is_active == True)  # noqa: E712
    return list((await db.execute(query)).scalars().all())


async def get_category_by_slug(slug: str, db: AsyncSession) -> Category:
    result = await db.execute(select(Category).where(Category.slug == slug))
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{slug}' not found",
        )
    return cat


async def create_category(payload: CategoryCreate, db: AsyncSession) -> Category:
    # Reject duplicate slugs
    existing = await db.execute(select(Category).where(Category.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category slug '{payload.slug}' already exists",
        )
    cat = Category(**payload.model_dump())
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return cat


async def update_category(
    slug: str, payload: CategoryUpdate, db: AsyncSession
) -> Category:
    cat = await get_category_by_slug(slug, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    await db.flush()
    await db.refresh(cat)
    return cat


async def delete_category(slug: str, db: AsyncSession) -> None:
    """
    Soft-delete: set is_active=False.
    Websites that already reference this slug keep their value;
    they just won't match future active-only queries.
    Hard delete is available separately if you truly need it.
    """
    cat = await get_category_by_slug(slug, db)
    cat.is_active = False
    await db.flush()


async def hard_delete_category(slug: str, db: AsyncSession) -> None:
    cat = await get_category_by_slug(slug, db)
    await db.delete(cat)
    await db.flush()


# ── Domain ────────────────────────────────────────────────────────────────────

async def list_domains(
    db: AsyncSession,
    active_only: bool = True,
    category_slug: Optional[str] = None,
) -> List[Domain]:
    query = select(Domain).order_by(Domain.sort_order, Domain.name)
    if active_only:
        query = query.where(Domain.is_active == True)  # noqa: E712
    if category_slug:
        query = query.where(Domain.category_slug == category_slug)
    return list((await db.execute(query)).scalars().all())


async def get_domain_by_slug(slug: str, db: AsyncSession) -> Domain:
    result = await db.execute(select(Domain).where(Domain.slug == slug))
    dom = result.scalar_one_or_none()
    if dom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain '{slug}' not found",
        )
    return dom


async def create_domain(payload: DomainCreate, db: AsyncSession) -> Domain:
    existing = await db.execute(select(Domain).where(Domain.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Domain slug '{payload.slug}' already exists",
        )
    # Validate parent category if provided
    if payload.category_slug:
        cat = await db.execute(
            select(Category).where(Category.slug == payload.category_slug)
        )
        if cat.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Parent category '{payload.category_slug}' does not exist",
            )
    dom = Domain(**payload.model_dump())
    db.add(dom)
    await db.flush()
    await db.refresh(dom)
    return dom


async def update_domain(slug: str, payload: DomainUpdate, db: AsyncSession) -> Domain:
    dom = await get_domain_by_slug(slug, db)
    if payload.category_slug is not None:
        cat = await db.execute(
            select(Category).where(Category.slug == payload.category_slug)
        )
        if cat.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Parent category '{payload.category_slug}' does not exist",
            )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(dom, field, value)
    await db.flush()
    await db.refresh(dom)
    return dom


async def delete_domain(slug: str, db: AsyncSession) -> None:
    """Soft-delete: set is_active=False."""
    dom = await get_domain_by_slug(slug, db)
    dom.is_active = False
    await db.flush()


async def hard_delete_domain(slug: str, db: AsyncSession) -> None:
    dom = await get_domain_by_slug(slug, db)
    await db.delete(dom)
    await db.flush()


# ── Validation helpers used by website_service ────────────────────────────────

async def validate_category_slug(slug: str, db: AsyncSession) -> None:
    """Raise 422 if slug is not an active category."""
    result = await db.execute(
        select(Category).where(Category.slug == slug, Category.is_active == True)  # noqa: E712
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{slug}' is not a valid active category slug. "
                   f"Call GET /categories to see available values.",
        )


async def validate_domain_slug(slug: str, db: AsyncSession) -> None:
    """Raise 422 if slug is not an active domain."""
    result = await db.execute(
        select(Domain).where(Domain.slug == slug, Domain.is_active == True)  # noqa: E712
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{slug}' is not a valid active domain slug. "
                   f"Call GET /domains to see available values.",
        )


# ── Categories with embedded domains (nav mega-menu) ─────────────────────────

async def list_categories_with_domains(db: AsyncSession) -> list:
    """
    Fetch all active categories and their active domains in two queries
    (categories, then all matching domains), grouped in Python.
    Returns list[CategoryWithDomainsOut] — ready for JSON serialisation.
    """
    from app.schemas.category import CategoryWithDomainsOut, DomainSlim

    # 1. All active categories ordered for display
    cats_result = await db.execute(
        select(Category)
        .where(Category.is_active == True)  # noqa: E712
        .order_by(Category.sort_order, Category.name)
    )
    categories = cats_result.scalars().all()

    if not categories:
        return []

    # 2. All active domains that belong to any of those categories — one query
    cat_slugs = [c.slug for c in categories]
    doms_result = await db.execute(
        select(Domain)
        .where(
            Domain.is_active == True,  # noqa: E712
            Domain.category_slug.in_(cat_slugs),
        )
        .order_by(Domain.sort_order, Domain.name)
    )
    domains = doms_result.scalars().all()

    # 3. Group domains by category_slug in Python (O(n) — no extra queries)
    from collections import defaultdict
    domains_by_cat: dict[str, list] = defaultdict(list)
    for dom in domains:
        if dom.category_slug:
            domains_by_cat[dom.category_slug].append(
                DomainSlim.model_validate(dom)
            )

    # 4. Assemble response
    return [
        CategoryWithDomainsOut(
            slug=cat.slug,
            name=cat.name,
            icon=cat.icon,
            sort_order=cat.sort_order,
            domains=domains_by_cat.get(cat.slug, []),
        )
        for cat in categories
    ]
