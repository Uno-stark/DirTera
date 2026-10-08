from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import AdminUser, CurrentUser, DBSession
from app.core.limiter import limiter
from app.models.subscription import Subscription
from app.schemas.subscription import (
    LinksETHealthFiltered,
    PlanConfigCreate,
    PlanConfigOut,
    PlanConfigUpdate,
    SubscriptionOut,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["Payments"])


# ── Plan CRUD (admin) ──────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanConfigOut], summary="List active plans")
async def list_plans(db: DBSession):
    return await payment_service.get_active_plans(db)


@router.get("/plans/all", response_model=list[PlanConfigOut], summary="All plans (admin)")
async def list_all_plans(_admin: AdminUser, db: DBSession):
    return await payment_service.get_all_plans(db)


@router.post("/plans", response_model=PlanConfigOut, status_code=201, summary="Create plan (admin)")
async def create_plan(payload: PlanConfigCreate, _admin: AdminUser, db: DBSession):
    return await payment_service.create_plan(payload, db)


@router.patch("/plans/{plan_id}", response_model=PlanConfigOut, summary="Update plan (admin)")
async def update_plan(plan_id: str, payload: PlanConfigUpdate, _admin: AdminUser, db: DBSession):
    return await payment_service.update_plan(plan_id, payload, db)


@router.delete("/plans/{plan_id}", status_code=204, summary="Deactivate/delete plan (admin)")
async def delete_plan(
    plan_id: str,
    _admin: AdminUser,
    db: DBSession,
    hard: bool = Query(False),
):
    if hard:
        await payment_service.hard_delete_plan(plan_id, db)
    else:
        await payment_service.delete_plan(plan_id, db)


# ── Subscription flow ──────────────────────────────────────────────────────────

@router.get("/subscribe/info", summary="Cost preview")
async def subscription_info(
    website_id: str,
    plan: str,
    current_user: CurrentUser,
    db: DBSession,
):
    return await payment_service.get_subscription_info(
        website_id, current_user.id, plan, db
    )


@router.post(
    "/verify",
    response_model=VerifyPaymentResponse,
    summary="Verify receipt and activate subscription",
)
@limiter.limit(settings.RATE_LIMIT_PAYMENT)
async def verify_payment(
    request: Request,
    response: Response,
    payload: VerifyPaymentRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Rate-limited to {RATE_LIMIT_PAYMENT} per IP — prevents receipt spamming."""
    return await payment_service.verify_payment(payload, current_user.id, db)


@router.get("/subscriptions", response_model=list[SubscriptionOut], summary="My subscriptions")
async def my_subscriptions(current_user: CurrentUser, db: DBSession):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    return result.scalars().all()


@router.get("/health", response_model=LinksETHealthFiltered, summary="links.et health")
async def linksset_health():
    return await payment_service.check_linksset_health()
