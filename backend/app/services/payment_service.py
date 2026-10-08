from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.plan_config import SubscriptionPlanConfig
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.website import Website, WebsiteStatus
from app.schemas.subscription import (
    LinksETComponent,
    LinksETHealthFiltered,
    LinksETHealthResponse,
    LinksETVerifyResponse,
    PlanConfigOut,
    SubscriptionOut,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)

# Float tolerance for receipt amount validation (in ETB)
AMOUNT_TOLERANCE: float = 1.0

LINKSSET_VERIFY_URL = "https://links.et/api/verify"
LINKSSET_STATUS_URL = "https://links.et/api/status"

WANTED_COMPONENT_NAMES = {
    "verify-web (this service)",
    "Postgres (auth + API keys)",
    "Telebirr — transactioninfo.ethiotelecom.et",
}


# ── Plan config helpers ────────────────────────────────────────────────────────

async def get_active_plans(db: AsyncSession) -> List[SubscriptionPlanConfig]:
    """Return all active plans ordered by sort_order."""
    result = await db.execute(
        select(SubscriptionPlanConfig)
        .where(SubscriptionPlanConfig.is_active == True)  
        .order_by(SubscriptionPlanConfig.sort_order, SubscriptionPlanConfig.label)
    )
    return list(result.scalars().all())


async def get_all_plans(db: AsyncSession) -> List[SubscriptionPlanConfig]:
    """Return all plans (active + inactive). Admin use."""
    result = await db.execute(
        select(SubscriptionPlanConfig)
        .order_by(SubscriptionPlanConfig.sort_order, SubscriptionPlanConfig.label)
    )
    return list(result.scalars().all())


async def get_plan_by_id(plan_id: str, db: AsyncSession) -> SubscriptionPlanConfig:
    result = await db.execute(
        select(SubscriptionPlanConfig).where(SubscriptionPlanConfig.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


async def get_plan_by_slug(slug: str, db: AsyncSession) -> SubscriptionPlanConfig:
    # Coerce enum objects to their string value in case an old enum-typed
    # field leaks through (e.g. from SubscriptionPlan enum).
    slug_str = slug.value if hasattr(slug, "value") else str(slug)
    result = await db.execute(
        select(SubscriptionPlanConfig).where(SubscriptionPlanConfig.slug == slug_str)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(
            status_code=422,
            detail=f"'{slug_str}' is not a valid plan. Call GET /payments/plans for available options.",
        )
    return plan


async def create_plan(
    payload: "PlanConfigCreate",  
    db: AsyncSession,
) -> SubscriptionPlanConfig:
    from app.schemas.subscription import PlanConfigCreate

    existing = await db.execute(
        select(SubscriptionPlanConfig).where(SubscriptionPlanConfig.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A plan with slug '{payload.slug}' already exists.",
        )
    plan = SubscriptionPlanConfig(**payload.model_dump())
    db.add(plan)
    await db.flush()
    return plan


async def update_plan(
    plan_id: str,
    payload: "PlanConfigUpdate",
    db: AsyncSession,
) -> SubscriptionPlanConfig:
    plan = await get_plan_by_id(plan_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.flush()
    return plan


async def delete_plan(plan_id: str, db: AsyncSession) -> None:
    """
    Soft-delete: set is_active=False.
    Existing subscriptions referencing this plan slug are not affected.
    """
    plan = await get_plan_by_id(plan_id, db)
    plan.is_active = False
    await db.flush()


async def hard_delete_plan(plan_id: str, db: AsyncSession) -> None:
    plan = await get_plan_by_id(plan_id, db)
    await db.delete(plan)
    await db.flush()


# ── Public subscription helpers ───────────────────────────────────────────────

async def get_subscription_info(
    website_id: str,
    user_id: str,
    plan_slug: str,
    db: AsyncSession,
) -> dict:
    """Returns plan price/duration preview before the user pays."""
    website = await _get_owned_approved_website(website_id, user_id, db)
    plan = await get_plan_by_slug(plan_slug, db)

    if not plan.is_active:
        raise HTTPException(status_code=400, detail="This plan is no longer available.")

    return {
        "website_id": website_id,
        "website_name": website.name,
        "plan": plan.slug,
        "label": plan.label,
        "amount": float(plan.amount),
        "currency": plan.currency,
        "duration_days": plan.duration_days,
        "is_premiered": plan.is_premiered,
    }


async def verify_payment(
    payload: VerifyPaymentRequest,
    user_id: str,
    db: AsyncSession,
) -> VerifyPaymentResponse:

    website = await _get_owned_approved_website(payload.website_id, user_id, db)

    # Load plan config from DB
    plan = await get_plan_by_slug(payload.plan, db)
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="This plan is no longer available.")

    # Prevent receipt reuse
    dup = await db.execute(
        select(Subscription).where(Subscription.receipt_url == payload.receipt_url)
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This receipt has already been used for another subscription.",
        )

    # Call links.et
    verify_result = await _call_linksset_verify(payload.receipt_url)

    if not verify_result.ok:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"links.et could not verify this receipt: {verify_result.error or 'unknown error'}",
        )

    receipt = verify_result.receipt
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="links.et returned no receipt data.",
        )

    # Validate settled amount against DB price
    expected_amount = float(plan.amount)
    settled_amount = _parse_birr_amount(receipt.get("settledAmount", ""))

    if settled_amount is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not parse settled amount from receipt.",
        )

    if abs(settled_amount - expected_amount) > AMOUNT_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Payment amount mismatch. "
                f"Expected {expected_amount:.2f} {plan.currency} for the '{plan.label}' plan, "
                f"but receipt shows {settled_amount:.2f} {plan.currency}."
            ),
        )

    tx_status = receipt.get("transactionStatus", "")
    if tx_status and tx_status.lower() != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transaction is not completed (status: {tx_status}).",
        )

    # ── Validate receiver identity (ALWAYS enforced) ───────────────────────
    # Both receiver_name and receiver_phone are required on every plan.
    # We double-check at runtime in case a legacy plan somehow has NULL values.
    if not plan.receiver_name or not plan.receiver_phone:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "This plan is not configured for payment verification. "
                "Please contact support."
            ),
        )

    receipt_credited_name  = (receipt.get("creditedPartyName")  or "").strip()
    receipt_credited_phone = (receipt.get("creditedPartyAccountNo") or "").strip()

    # ── Name check ────────────────────────────────────────────────────────
    if not receipt_credited_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Receipt does not contain a credited party name.",
        )

    if plan.receiver_name.strip().lower() not in receipt_credited_name.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Receiver name mismatch. "
                f"Expected '{plan.receiver_name.strip()}', "
                f"but receipt shows '{receipt_credited_name}'."
            ),
        )

    # ── Phone check (masked-phone-aware) ──────────────────────────────────
    
    if not receipt_credited_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Receipt does not contain a credited party account number.",
        )

    def _normalise_phone(p: str) -> str:
        """Strip formatting and country code, return last 9 local digits."""
        p = re.sub(r"[\s\-\(\)]", "", p)
        p = re.sub(r"^\+?251", "", p).lstrip("0")
        return p

    def _visible_suffix(masked: str) -> str:
        
        # Find the last continuous run of non-asterisk digits after the mask
        match = re.search(r"\*+([0-9]+)$", masked)
        if match:
            return match.group(1)
        # Not masked — normalise normally
        return _normalise_phone(masked)

    plan_phone_norm   = _normalise_phone(plan.receiver_phone)
    receipt_suffix    = _visible_suffix(receipt_credited_phone)

    # The receipt suffix must match the LAST N digits of the plan phone
    # where N = len(suffix)
    if not receipt_suffix:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract phone digits from receipt account number.",
        )

    if not plan_phone_norm.endswith(receipt_suffix):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Receiver phone mismatch. "
                "The payment was not sent to the correct DirTera account."
            ),
        )

    # Activate subscription
    now = datetime.now(timezone.utc)
    sub = Subscription(
        user_id=user_id,
        website_id=payload.website_id,
        plan=payload.plan,
        amount=expected_amount,
        currency=plan.currency,
        status=SubscriptionStatus.ACTIVE,
        receipt_url=payload.receipt_url,
        payment_provider=verify_result.providerKey,
        receipt_no=receipt.get("receiptNo"),
        starts_at=now,
        expires_at=now + timedelta(days=plan.duration_days),
    )
    db.add(sub)
    await db.flush()

    website.linksset_subscription_id = receipt.get("receiptNo") or str(sub.id)
    if plan.is_premiered:
        website.is_premiered = True
    await db.flush()

    return VerifyPaymentResponse(
        subscription=SubscriptionOut.model_validate(sub),
        receipt=receipt,
        provider=verify_result.providerKey or "unknown",
        message=(
            f"Subscription activated. "
            f"Your '{plan.label}' plan is valid for {plan.duration_days} days."
        ),
    )


# ── Health ────────────────────────────────────────────────────────────────────

async def check_linksset_health() -> LinksETHealthFiltered:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(LINKSSET_STATUS_URL)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not reach links.et status endpoint: {exc}",
        )

    health = LinksETHealthResponse(**data)
    filtered: List[LinksETComponent] = [
        c for c in health.components if c.name in WANTED_COMPONENT_NAMES
    ]
    return LinksETHealthFiltered(
        ok=health.ok,
        status=health.status,
        checkedAt=health.checkedAt,
        components=filtered,
    )


# ── Private helpers ────────────────────────────────────────────────────────────

async def _get_owned_approved_website(
    website_id: str, user_id: str, db: AsyncSession
) -> Website:
    result = await db.execute(select(Website).where(Website.id == website_id))
    website = result.scalar_one_or_none()
    if website is None:
        raise HTTPException(status_code=404, detail="Website not found.")
    if website.owner_id != user_id:
        raise HTTPException(status_code=403, detail="You don't own this website.")
    if website.status != WebsiteStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Website must be approved before subscribing.",
        )
    return website


async def _call_linksset_verify(receipt_url: str) -> LinksETVerifyResponse:
    if not settings.LINKSSET_API_KEY:
        # Dev / test mode — mock a successful Telebirr receipt.
        # creditedPartyName / creditedPartyAccountNo are left empty in the
        # mock so receiver validation passes when no plan receiver is set.
        # To test receiver validation, set receiver_name/receiver_phone on
        # the plan and pass ?credited_name=... in the mock URL.
        import urllib.parse
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(receipt_url).query)
        mock_credited_name  = qs.get("credited_name",  [""])[0]
        mock_credited_phone = qs.get("credited_phone", [""])[0]

        return LinksETVerifyResponse(
            ok=True,
            providerKey="telebirr",
            resolvedUrl=receipt_url,
            httpStatus=200,
            fetchedAt=datetime.now(timezone.utc).isoformat(),
            receipt={
                "source":                  "telebirr-html",
                "transactionStatus":       "Completed",
                "receiptNo":               "MOCK1234AB",
                "settledAmount":           f"{_mock_amount_for_url(receipt_url)} Birr",
                "totalPaidAmount":         f"{_mock_amount_for_url(receipt_url)} Birr",
                "payerName":               "Test Payer",
                "paymentMode":             "telebirr",
                "creditedPartyName":       mock_credited_name,
                "creditedPartyAccountNo":  mock_credited_phone,
            },
        )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                LINKSSET_VERIFY_URL,
                headers={
                    "x-api-key": settings.LINKSSET_API_KEY,
                    "content-type": "application/json",
                },
                json={"url": receipt_url},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"links.et verify API unreachable: {exc}",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"links.et verify returned HTTP {resp.status_code}: {resp.text}",
        )

    body = resp.json()

    # links.et returns either a single object OR an array with one element.
    # Normalise to always work with a single dict.
    if isinstance(body, list):
        if not body:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="links.et returned an empty response array.",
            )
        result_dict = body[0]
    elif isinstance(body, dict):
        result_dict = body
    else:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unexpected response shape from links.et: {type(body).__name__}",
        )

    return LinksETVerifyResponse(**result_dict)


def _parse_birr_amount(value: str) -> Optional[float]:
    if not value:
        return None
    cleaned = re.sub(r"[^\d,.]", "", value.replace(",", ""))
    try:
        return float(cleaned)
    except ValueError:
        return None


def _mock_amount_for_url(url: str) -> float:
    import urllib.parse
    try:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        # Use first active plan's amount if no ?amount= param
        amount_str = qs.get("amount", ["500.0"])[0]
        return float(amount_str)
    except (ValueError, IndexError):
        return 500.0
