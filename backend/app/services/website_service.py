from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import Select, String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.website import Website, WebsiteStatus
from app.schemas.website import (
    CategoryBlockItem,
    MultiCategoryResponse,
    RejectWebsite,
    TopNResponse,
    WebsiteAdminUpdate,
    WebsiteCreate,
    WebsiteOut,
    WebsiteUpdate,
)
from app.services.category_service import validate_category_slug, validate_domain_slug
from app.services.notification_service import create_notification


# ── Sort helpers ───────────────────────────────────────────────────────────────

def _apply_sort(query: Select, sort_by: str) -> Select:
    if sort_by == "rating":
        return query.order_by(
            Website.avg_rating.desc(),
            Website.total_clicks.desc(),
            Website.created_at.desc(),
        )
    if sort_by == "clicks":
        return query.order_by(
            Website.total_clicks.desc(),
            Website.avg_rating.desc(),
            Website.created_at.desc(),
        )
    if sort_by == "newest":
        return query.order_by(Website.created_at.desc())
    # default: "score"
    return query.order_by(
        Website.is_premiered.desc(),
        Website.avg_rating.desc(),
        Website.total_clicks.desc(),
        Website.created_at.desc(),
    )


def _base_public_query() -> Select:
    return (
        select(Website)
        .options(selectinload(Website.owner))
        .where(
            Website.status == WebsiteStatus.APPROVED,
            Website.is_active == True,  # noqa: E712
        )
    )


def _apply_keyword_filter(query: Select, keywords: Optional[str]) -> Select:
    """
    Each comma-separated term is OR-matched against:
    name, short_description, full_description, tags,
    category_slug, domain_slug.
    """
    if not keywords:
        return query
    terms = [t.strip() for t in keywords.split(",") if t.strip()]
    if not terms:
        return query

    clauses = []
    for term in terms:
        like = f"%{term}%"
        clauses.append(Website.name.ilike(like))
        clauses.append(Website.short_description.ilike(like))
        clauses.append(Website.full_description.ilike(like))
        clauses.append(Website.tags.ilike(like))
        clauses.append(Website.category_slug.ilike(like))
        clauses.append(Website.domain_slug.ilike(like))

    return query.where(or_(*clauses))


# ── CRUD ───────────────────────────────────────────────────────────────────────

async def create_website(payload: WebsiteCreate, owner: User, db: AsyncSession) -> Website:
    # Validate slugs against DB taxonomy
    if payload.category_slug:
        await validate_category_slug(payload.category_slug, db)
    if payload.domain_slug:
        await validate_domain_slug(payload.domain_slug, db)

    existing = await db.execute(select(Website).where(Website.url == payload.url))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A listing with this URL already exists",
        )
    website = Website(owner_id=owner.id, **payload.model_dump())
    db.add(website)
    await db.flush()
    return website


async def get_website_by_id(website_id: str, db: AsyncSession) -> Website:
    result = await db.execute(
        select(Website)
        .options(selectinload(Website.owner))
        .where(Website.id == website_id)
    )
    website = result.scalar_one_or_none()
    if website is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Website not found")
    return website


async def get_website_owned_by(website_id: str, owner_id: str, db: AsyncSession) -> Website:
    website = await get_website_by_id(website_id, db)
    if website.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't own this listing")
    return website


async def update_website(website: Website, payload: WebsiteUpdate, db: AsyncSession) -> Website:
    dirty = payload.model_dump(exclude_unset=True, exclude_none=True)

    # Validate updated slugs
    if "category_slug" in dirty and dirty["category_slug"]:
        await validate_category_slug(dirty["category_slug"], db)
    if "domain_slug" in dirty and dirty["domain_slug"]:
        await validate_domain_slug(dirty["domain_slug"], db)

    if website.status == WebsiteStatus.APPROVED:
        key_fields = {"url", "name", "short_description", "full_description"}
        if key_fields & dirty.keys():
            website.status = WebsiteStatus.PENDING
            website.rejection_message = None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(website, field, value)
    await db.flush()
    return website


async def admin_update_website(
    website_id: str, payload: WebsiteAdminUpdate, db: AsyncSession
) -> Website:
    website = await get_website_by_id(website_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(website, field, value)
    await db.flush()
    return website


async def delete_website(website: Website, db: AsyncSession) -> None:
    await db.delete(website)
    await db.flush()


async def approve_website(website_id: str, admin: User, db: AsyncSession) -> Website:
    website = await get_website_by_id(website_id, db)
    if website.status != WebsiteStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve a listing with status '{website.status}'",
        )
    website.status = WebsiteStatus.APPROVED
    website.reviewed_by_id = admin.id
    website.rejection_message = None
    await db.flush()
    await create_notification(
        user_id=website.owner_id,
        title="Your listing was approved!",
        body=f'"{website.name}" has been approved and is now live on DirTera.',
        website_id=website.id,
        db=db,
    )
    return website


async def reject_website(
    website_id: str, payload: RejectWebsite, admin: User, db: AsyncSession
) -> Website:
    website = await get_website_by_id(website_id, db)
    if website.status not in (WebsiteStatus.PENDING, WebsiteStatus.APPROVED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject this listing",
        )
    website.status = WebsiteStatus.REJECTED
    website.reviewed_by_id = admin.id
    website.rejection_message = payload.rejection_message
    await db.flush()
    await create_notification(
        user_id=website.owner_id,
        title="Your listing was not approved",
        body=f'"{website.name}" was rejected.\nReason: {payload.rejection_message}',
        website_id=website.id,
        db=db,
    )
    return website


# ── Public listing queries ─────────────────────────────────────────────────────

async def list_websites_public(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    category_slug: Optional[str] = None,
    domain_slug: Optional[str] = None,
    keywords: Optional[str] = None,
    is_premiered: Optional[bool] = None,
    sort_by: str = "score",
) -> Tuple[List[Website], int]:
    query = _base_public_query()

    if category_slug:
        query = query.where(Website.category_slug == category_slug)
    if domain_slug:
        query = query.where(Website.domain_slug == domain_slug)
    if is_premiered is not None:
        query = query.where(Website.is_premiered == is_premiered)

    query = _apply_keyword_filter(query, keywords)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = _apply_sort(query, sort_by).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).scalars().all()
    return list(rows), total


async def get_top_n(
    db: AsyncSession,
    limit: int = 10,
    category_slug: Optional[str] = None,
    domain_slug: Optional[str] = None,
    keywords: Optional[str] = None,
    sort_by: str = "score",
) -> TopNResponse:
    limit = min(limit, 50)
    query = _base_public_query()

    if category_slug:
        query = query.where(Website.category_slug == category_slug)
    if domain_slug:
        query = query.where(Website.domain_slug == domain_slug)

    query = _apply_keyword_filter(query, keywords)

    count_q = select(func.count()).select_from(query.subquery())
    total_found = (await db.execute(count_q)).scalar_one()

    query = _apply_sort(query, sort_by).limit(limit)
    rows = (await db.execute(query)).scalars().all()

    return TopNResponse(
        limit=limit,
        sort_by=sort_by,
        total_found=total_found,
        items=[WebsiteOut.model_validate(r) for r in rows],
    )


async def get_multi_category(
    db: AsyncSession,
    category_slugs: List[str],
    per_category: int = 5,
    sort_by: str = "score",
    domain_slug: Optional[str] = None,
    keywords: Optional[str] = None,
) -> MultiCategoryResponse:
    category_slugs = category_slugs[:10]
    per_category = min(per_category, 20)

    blocks: List[CategoryBlockItem] = []
    for slug in category_slugs:
        query = _base_public_query().where(Website.category_slug == slug)
        if domain_slug:
            query = query.where(Website.domain_slug == domain_slug)
        query = _apply_keyword_filter(query, keywords)
        query = _apply_sort(query, sort_by).limit(per_category)
        rows = (await db.execute(query)).scalars().all()
        blocks.append(
            CategoryBlockItem(
                category_slug=slug,
                items=[WebsiteOut.model_validate(r) for r in rows],
            )
        )

    return MultiCategoryResponse(per_category=per_category, blocks=blocks)


# ── Admin / owner listing queries ──────────────────────────────────────────────

async def list_websites_admin(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[WebsiteStatus] = None,
    search: Optional[str] = None,
    category_slug: Optional[str] = None,
    domain_slug: Optional[str] = None,
) -> Tuple[List[Website], int]:
    query = select(Website).options(selectinload(Website.owner))
    if status_filter:
        query = query.where(Website.status == status_filter)
    if category_slug:
        query = query.where(Website.category_slug == category_slug)
    if domain_slug:
        query = query.where(Website.domain_slug == domain_slug)
    if search:
        like = f"%{search}%"
        query = query.where(
            (Website.name.ilike(like)) | (Website.url.ilike(like))
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Website.created_at.desc())
    )
    rows = (await db.execute(query)).scalars().all()
    return list(rows), total


async def list_my_websites(
    owner_id: str,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Website], int]:
    query = select(Website).where(Website.owner_id == owner_id)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()
    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Website.created_at.desc())
    )
    rows = (await db.execute(query)).scalars().all()
    return list(rows), total
