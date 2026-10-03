from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import AdminUser, CurrentUser, DBSession
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


# ══════════════════════════════════════════════════════════════════════════════
#  PLAN CRUD  (admin)
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/plans",
    response_model=list[PlanConfigOut],
    summary="List active subscription plans",
)
async def list_plans(db: DBSession):
    """
    Public endpoint — returns only active plans, ordered by sort_order.
    Use this to render the plan picker in the frontend.
    """
    plans = await payment_service.get_active_plans(db)
    return plans


@router.get(
    "/plans/all",
    response_model=list[PlanConfigOut],
    summary="List ALL plans including inactive (admin)",
)
async def list_all_plans(_admin: AdminUser, db: DBSession):
    """Admin: returns all plans regardless of is_active flag."""
    return await payment_service.get_all_plans(db)


@router.post(
    "/plans",
    response_model=PlanConfigOut,
    status_code=201,
    summary="Create a subscription plan (admin)",
)
async def create_plan(
    payload: PlanConfigCreate,
    _admin: AdminUser,
    db: DBSession,
):
    
    return await payment_service.create_plan(payload, db)


@router.patch(
    "/plans/{plan_id}",
    response_model=PlanConfigOut,
    summary="Update a subscription plan (admin)",
)
async def update_plan(
    plan_id: str,
    payload: PlanConfigUpdate,
    _admin: AdminUser,
    db: DBSession,
):
    
    return await payment_service.update_plan(plan_id, payload, db)


@router.delete(
    "/plans/{plan_id}",
    status_code=204,
    summary="Deactivate or delete a subscription plan (admin)",
)
async def delete_plan(
    plan_id: str,
    _admin: AdminUser,
    db: DBSession,
    hard: bool = Query(
        False,
        description=(
            "false (default) — soft-deactivate: sets is_active=false, "
            "existing subscriptions are unaffected. "
            "true — hard delete the row from the DB."
        ),
    ),
):
    if hard:
        await payment_service.hard_delete_plan(plan_id, db)
    else:
        await payment_service.delete_plan(plan_id, db)


# ══════════════════════════════════════════════════════════════════════════════
#  SUBSCRIPTION FLOW
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/subscribe/info",
    summary="Get subscription cost preview",
)
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
    summary="Verify payment receipt and activate subscription",
)
async def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    
    return await payment_service.verify_payment(payload, current_user.id, db)


@router.get(
    "/subscriptions",
    response_model=list[SubscriptionOut],
    summary="List my subscriptions",
)
async def my_subscriptions(current_user: CurrentUser, db: DBSession):
    """All subscriptions belonging to the current user, newest first."""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    return result.scalars().all()


@router.get(
    "/health",
    response_model=LinksETHealthFiltered,
    summary="links.et service health",
)
async def linksset_health():
    
    return await payment_service.check_linksset_health()
