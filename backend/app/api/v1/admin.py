from __future__ import annotations

import math

from fastapi import APIRouter, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, DBSession
from app.models.category import Category, Domain
from app.models.plan_config import SubscriptionPlanConfig
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.models.website import Website, WebsiteStatus
from app.schemas.common import PaginatedResponse
from app.schemas.subscription import AdminSubscriptionOut
from app.schemas.website import WebsitePendingOut

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard", summary="Platform-wide stats")
async def dashboard_stats(_admin: AdminUser, db: DBSession):
    """Returns counts for the admin overview page."""

    # ── Users ─────────────────────────────────────────────────────────────────
    user_row = (
        await db.execute(
            select(
                func.count(User.id).label("total"),
                func.count(case((User.is_active == True, 1))).label("active"),  # noqa: E712
            )
        )
    ).one()

    # ── Websites ──────────────────────────────────────────────────────────────
    site_row = (
        await db.execute(
            select(
                func.count(Website.id).label("total"),
                func.count(case((Website.status == WebsiteStatus.PENDING,   1))).label("pending"),
                func.count(case((Website.status == WebsiteStatus.APPROVED,  1))).label("approved"),
                func.count(case((Website.status == WebsiteStatus.REJECTED,  1))).label("rejected"),
                func.count(case((Website.is_premiered == True,              1))).label("premiered"),  # noqa: E712
            )
        )
    ).one()

    # ── Subscriptions ─────────────────────────────────────────────────────────
    active_subs = (
        await db.execute(
            select(func.count(Subscription.id)).where(
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
    ).scalar_one()

    # ── Taxonomy ──────────────────────────────────────────────────────────────
    cat_row = (
        await db.execute(
            select(
                func.count(Category.id).label("total"),
                func.count(case((Category.is_active == True, 1))).label("active"),  # noqa: E712
            )
        )
    ).one()

    dom_row = (
        await db.execute(
            select(
                func.count(Domain.id).label("total"),
                func.count(case((Domain.is_active == True, 1))).label("active"),  # noqa: E712
            )
        )
    ).one()

    # ── Plans ─────────────────────────────────────────────────────────────────
    plan_row = (
        await db.execute(
            select(
                func.count(SubscriptionPlanConfig.id).label("total"),
                func.count(
                    case((SubscriptionPlanConfig.is_active == True, 1))  # noqa: E712
                ).label("active"),
            )
        )
    ).one()

    return {
        "users": {
            "total": user_row.total,
            "active": user_row.active,
        },
        "websites": {
            "total":     site_row.total,
            "pending":   site_row.pending,
            "approved":  site_row.approved,
            "rejected":  site_row.rejected,
            "premiered": site_row.premiered,
        },
        "subscriptions": {
            "active": active_subs,
        },
        "taxonomy": {
            "categories": {"total": cat_row.total, "active": cat_row.active},
            "domains":    {"total": dom_row.total, "active": dom_row.active},
        },
        "plans": {
            "total":  plan_row.total,
            "active": plan_row.active,
        },
    }


@router.get(
    "/requests",
    response_model=PaginatedResponse[WebsitePendingOut],
    summary="Pending approval queue",
)
async def pending_requests(
    _admin: AdminUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Shortcut for the pending approval queue with owner info."""
    base_q = (
        select(Website)
        .options(selectinload(Website.owner))
        .where(Website.status == WebsiteStatus.PENDING)
        .order_by(Website.created_at.asc())
    )
    total = (
        await db.execute(
            select(func.count(Website.id)).where(Website.status == WebsiteStatus.PENDING)
        )
    ).scalar_one()

    rows = (
        await db.execute(base_q.offset((page - 1) * page_size).limit(page_size))
    ).scalars().all()

    return PaginatedResponse(
        items=[WebsitePendingOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get(
    "/subscriptions",
    response_model=PaginatedResponse[AdminSubscriptionOut],
    summary="List all subscriptions (admin)",
)
async def list_all_subscriptions(
    _admin: AdminUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: SubscriptionStatus | None = Query(None, description="Filter by status"),
):
    """Returns a paginated list of every subscription across all users."""
    base_q = select(Subscription)
    if status is not None:
        base_q = base_q.where(Subscription.status == status)

    total = (
        await db.execute(select(func.count(Subscription.id)).where(
            *([Subscription.status == status] if status is not None else [])
        ))
    ).scalar_one()

    rows = (
        await db.execute(
            base_q.order_by(Subscription.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return PaginatedResponse(
        items=[AdminSubscriptionOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )
