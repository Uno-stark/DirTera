from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.subscription import Subscription, SubscriptionPlan, SubscriptionStatus
from app.models.website import Website, WebsiteStatus
from app.schemas.subscription import (
    LinksETComponent,
    LinksETHealthFiltered,
    LinksETHealthResponse,
    LinksETVerifyResponse,
    SubscriptionOut,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)

# ── Plan configuration ─────────────────────────────────────────────────────────
# Admin-set prices in ETB. Keep in sync with your links.et merchant settings.
PLAN_PRICES: dict[SubscriptionPlan, float] = {
    SubscriptionPlan.BASIC: 500.0,
    SubscriptionPlan.STANDARD: 1200.0,
    SubscriptionPlan.PREMIUM: 2500.0,
    SubscriptionPlan.PREMIERED: 5000.0,
}

PLAN_DURATIONS: dict[SubscriptionPlan, int] = {
    SubscriptionPlan.BASIC: 30,
    SubscriptionPlan.STANDARD: 90,
    SubscriptionPlan.PREMIUM: 180,
    SubscriptionPlan.PREMIERED: 30,
}

# How much tolerance to allow for floating-point / rounding (in ETB)
AMOUNT_TOLERANCE: float = 1.0

LINKSSET_VERIFY_URL = "https://links.et/api/verify"
LINKSSET_STATUS_URL = "https://links.et/api/status"

# Components we care about from the health endpoint
WANTED_COMPONENT_NAMES = {
    "verify-web (this service)",
    "Postgres (auth + API keys)",
    "Telebirr — transactioninfo.ethiotelecom.et",
}


# ── Public helpers ─────────────────────────────────────────────────────────────

def get_plan_prices() -> dict:
    """Expose plan prices so the frontend can display them."""
    return {plan.value: price for plan, price in PLAN_PRICES.items()}


async def get_subscription_info(
    website_id: str,
    user_id: str,
    plan: SubscriptionPlan,
    db: AsyncSession,
) -> dict:
    """
    Returns plan price and duration so the frontend can show the user
    what they'll be charged before they pay.
    """
    result = await db.execute(select(Website).where(Website.id == website_id))
    website = result.scalar_one_or_none()
    if website is None:
        raise HTTPException(status_code=404, detail="Website not found")
    if website.owner_id != user_id:
        raise HTTPException(status_code=403, detail="You don't own this website")
    if website.status != WebsiteStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Website must be approved before subscribing")

    return {
        "website_id": website_id,
        "website_name": website.name,
        "plan": plan.value,
        "amount": PLAN_PRICES[plan],
        "currency": "ETB",
        "duration_days": PLAN_DURATIONS[plan],
    }


async def verify_payment(
    payload: VerifyPaymentRequest,
    user_id: str,
    db: AsyncSession,
) -> VerifyPaymentResponse:
    """
    Main verification entry point.

    Steps:
    1. Validate website ownership + approval status
    2. Check receipt URL hasn't been used already
    3. Call links.et /api/verify
    4. Parse and validate the settled amount against plan price
    5. Activate subscription
    """
    # ── 1. Validate website ────────────────────────────────────────────────────
    w_result = await db.execute(select(Website).where(Website.id == payload.website_id))
    website = w_result.scalar_one_or_none()
    if website is None:
        raise HTTPException(status_code=404, detail="Website not found")
    if website.owner_id != user_id:
        raise HTTPException(status_code=403, detail="You don't own this website")
    if website.status != WebsiteStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Website must be approved before subscribing")

    # ── 2. Prevent receipt reuse ───────────────────────────────────────────────
    dup = await db.execute(
        select(Subscription).where(Subscription.receipt_url == payload.receipt_url)
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This receipt has already been used for another subscription",
        )

    # ── 3. Call links.et verify API ────────────────────────────────────────────
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
            detail="links.et returned no receipt data",
        )

    # ── 4. Validate settled amount ─────────────────────────────────────────────
    expected_amount = PLAN_PRICES[payload.plan]
    settled_amount = _parse_birr_amount(receipt.get("settledAmount", ""))

    if settled_amount is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not parse settled amount from receipt",
        )

    if abs(settled_amount - expected_amount) > AMOUNT_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Payment amount mismatch. "
                f"Expected {expected_amount:.2f} ETB for the {payload.plan.value} plan, "
                f"but receipt shows {settled_amount:.2f} ETB."
            ),
        )

    # Validate transaction status (telebirr-specific field)
    tx_status = receipt.get("transactionStatus", "")
    if tx_status and tx_status.lower() != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transaction is not completed (status: {tx_status})",
        )

    # ── 5. Create / activate subscription ─────────────────────────────────────
    now = datetime.now(timezone.utc)
    duration = PLAN_DURATIONS[payload.plan]

    sub = Subscription(
        user_id=user_id,
        website_id=payload.website_id,
        plan=payload.plan,
        amount=expected_amount,
        currency="ETB",
        status=SubscriptionStatus.ACTIVE,
        receipt_url=payload.receipt_url,
        payment_provider=verify_result.providerKey,
        receipt_no=receipt.get("receiptNo"),
        starts_at=now,
        expires_at=now + timedelta(days=duration),
    )
    db.add(sub)
    await db.flush()

    # Update website
    website.linksset_subscription_id = receipt.get("receiptNo") or str(sub.id)
    if payload.plan == SubscriptionPlan.PREMIERED:
        website.is_premiered = True
    await db.flush()

    return VerifyPaymentResponse(
        subscription=SubscriptionOut.model_validate(sub),
        receipt=receipt,
        provider=verify_result.providerKey or "unknown",
        message=f"Subscription activated. Your {payload.plan.value} plan is valid for {duration} days.",
    )


async def check_linksset_health() -> LinksETHealthFiltered:
    """
    Fetch links.et /api/status and return only the 3 relevant components:
      - verify-web (this service)
      - Postgres (auth + API keys)
      - Telebirr — transactioninfo.ethiotelecom.et
    """
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

    filtered_components: List[LinksETComponent] = [
        c for c in health.components if c.name in WANTED_COMPONENT_NAMES
    ]

    return LinksETHealthFiltered(
        ok=health.ok,
        status=health.status,
        checkedAt=health.checkedAt,
        components=filtered_components,
    )


# ── Internal helpers ───────────────────────────────────────────────────────────

async def _call_linksset_verify(receipt_url: str) -> LinksETVerifyResponse:
    """
    POST to links.et /api/verify with the receipt URL.
    Returns the first element of the response array.
    """
    if not settings.LINKSSET_API_KEY:
        # Dev / test mode — return a plausible mock so the full flow can be tested
        return LinksETVerifyResponse(
            ok=True,
            providerKey="telebirr",
            resolvedUrl=receipt_url,
            httpStatus=200,
            fetchedAt=datetime.now(timezone.utc).isoformat(),
            receipt={
                "source": "telebirr-html",
                "transactionStatus": "Completed",
                "receiptNo": "MOCK1234AB",
                "settledAmount": f"{_mock_amount_for_url(receipt_url)} Birr",
                "totalPaidAmount": f"{_mock_amount_for_url(receipt_url)} Birr",
                "payerName": "Test User",
                "paymentMode": "telebirr",
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

    results: List[dict] = resp.json()
    if not results:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="links.et returned an empty response array",
        )

    return LinksETVerifyResponse(**results[0])


def _parse_birr_amount(value: str) -> Optional[float]:
    """
    Parse an amount string like "100 Birr", "1,200.50 Birr", or "500.00 ETB"
    and return a float.  Returns None if parsing fails.
    """
    if not value:
        return None
    # Strip non-numeric characters except digits, commas, periods
    cleaned = re.sub(r"[^\d,.]", "", value.replace(",", ""))
    try:
        return float(cleaned)
    except ValueError:
        return None


def _mock_amount_for_url(url: str) -> float:
    """
    In dev mode, extract an amount hint from a specially crafted mock URL
    like ?amount=500 so tests can exercise the amount-validation path.
    Falls back to BASIC plan price.
    """
    import urllib.parse
    try:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        return float(qs.get("amount", [str(PLAN_PRICES[SubscriptionPlan.BASIC])])[0])
    except (ValueError, IndexError):
        return PLAN_PRICES[SubscriptionPlan.BASIC]
