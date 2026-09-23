from __future__ import annotations

import math

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, DBSession
from app.models.category import Category, Domain
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.models.website import Website, WebsiteStatus
from app.schemas.common import PaginatedResponse
from app.schemas.website import WebsitePendingOut

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard", summary="Platform-wide stats")
async def dashboard_stats(_admin: AdminUser, db: DBSession):
    """Returns counts for the admin overview page."""

    async def _count(model, *filters):
        q = select(func.count()).select_from(model)
        for f in filters:
            q = q.where(f)
        return (await db.execute(q)).scalar_one()

    total_users          = await _count(User)
    active_users         = await _count(User,         User.is_active == True)       # noqa: E712
    total_websites       = await _count(Website)
    pending_websites     = await _count(Website,      Website.status == WebsiteStatus.PENDING)
    approved_websites    = await _count(Website,      Website.status == WebsiteStatus.APPROVED)
    rejected_websites    = await _count(Website,      Website.status == WebsiteStatus.REJECTED)
    premiered_websites   = await _count(Website,      Website.is_premiered == True)  # noqa: E712
    active_subscriptions = await _count(Subscription, Subscription.status == SubscriptionStatus.ACTIVE)
    total_categories     = await _count(Category)
    active_categories    = await _count(Category,     Category.is_active == True)   # noqa: E712
    total_domains        = await _count(Domain)
    active_domains       = await _count(Domain,       Domain.is_active == True)     # noqa: E712

    return {
        "users": {
            "total": total_users,
            "active": active_users,
        },
        "websites": {
            "total": total_websites,
            "pending": pending_websites,
            "approved": approved_websites,
            "rejected": rejected_websites,
            "premiered": premiered_websites,
        },
        "subscriptions": {
            "active": active_subscriptions,
        },
        "taxonomy": {
            "categories": {"total": total_categories, "active": active_categories},
            "domains":    {"total": total_domains,    "active": active_domains},
        },
    }


@router.get("/requests", response_model=PaginatedResponse[WebsitePendingOut], summary="Pending approval queue")
async def pending_requests(
    _admin: AdminUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Shortcut for the pending approval queue with owner info.
    Equivalent to GET /websites/admin/all?status=pending.
    """
    query = (
        select(Website)
        .options(selectinload(Website.owner))
        .where(Website.status == WebsiteStatus.PENDING)
        .order_by(Website.created_at.asc())
    )
    count_q = select(func.count()).select_from(
        select(Website).where(Website.status == WebsiteStatus.PENDING).subquery()
    )
    total = (await db.execute(count_q)).scalar_one()
    query = query.offset((page - 1) * page_size).limit(page_size)
    rows  = (await db.execute(query)).scalars().all()

    return PaginatedResponse(
        items=[WebsitePendingOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )
