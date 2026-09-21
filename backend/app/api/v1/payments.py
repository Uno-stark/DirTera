"""
Payment / subscription endpoints — receipt-based links.et verification.

GET  /payments/plans                 → plan prices + durations
GET  /payments/subscribe/info        → cost preview before paying
POST /payments/verify                → submit receipt URL, activate subscription
GET  /payments/subscriptions         → list my subscriptions
GET  /payments/health                → links.et service health (filtered)
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.subscription import Subscription, SubscriptionPlan
from app.schemas.subscription import (
    LinksETHealthFiltered,
    SubscriptionOut,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/plans", summary="List subscription plans and prices")
async def list_plans():
    """
    Returns all available plans with their prices (ETB) and durations.
    Show this to the user before they go pay.
    """
    from app.services.payment_service import PLAN_DURATIONS, PLAN_PRICES
    return [
        {
            "plan": plan.value,
            "amount": PLAN_PRICES[plan],
            "currency": "ETB",
            "duration_days": PLAN_DURATIONS[plan],
        }
        for plan in PLAN_PRICES
    ]


@router.get("/subscribe/info", summary="Get subscription cost preview")
async def subscription_info(
    website_id: str,
    plan: SubscriptionPlan,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Returns the expected amount for the chosen plan so the user knows
    exactly what to pay before they open their payment app.
    """
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
    """
    Submit the receipt URL from your payment provider (Telebirr, CBE, etc.).

    links.et fetches and parses the receipt, we validate the settled amount
    against the plan price, then activate the subscription.

    The receipt URL is stored for reference; the full receipt can always be
    re-fetched via links.et.
    """
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
    """
    Proxies the links.et /api/status endpoint and returns only the
    three components relevant to DirTera:
      - verify-web (the links.et service itself)
      - Postgres (links.et auth + API keys DB)
      - Telebirr upstream
    """
    return await payment_service.check_linksset_health()
