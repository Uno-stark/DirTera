from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.subscription import SubscriptionPlan, SubscriptionStatus


# ── Request schemas ────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    """Plan selection before the user goes to pay."""
    website_id: str      # ULID
    plan: SubscriptionPlan


class VerifyPaymentRequest(BaseModel):
    """
    Submitted by the frontend after the user has completed payment.
    The user provides their receipt URL (Telebirr / CBE / etc.).
    """
    website_id: str      # ULID
    plan: SubscriptionPlan
    receipt_url: str


# ── links.et API response schemas ─────────────────────────────────────────────

class TelebirrReceipt(BaseModel):
    """Parsed receipt fields returned by links.et for Telebirr payments."""
    source: str = "telebirr-html"
    payerName: Optional[str] = None
    payerTelebirrNo: Optional[str] = None
    payerAccountType: Optional[str] = None
    creditedPartyName: Optional[str] = None
    creditedPartyAccountNo: Optional[str] = None
    transactionStatus: Optional[str] = None
    receiptNo: Optional[str] = None
    paymentDate: Optional[str] = None
    settledAmount: Optional[str] = None     # e.g. "100 Birr"
    serviceFee: Optional[str] = None
    serviceFeeVAT: Optional[str] = None
    totalPaidAmount: Optional[str] = None
    paymentReason: Optional[str] = None
    paymentMode: Optional[str] = None
    paymentChannel: Optional[str] = None


class LinksETVerifyResponse(BaseModel):
    """Single element from the links.et /api/verify response array."""
    ok: bool
    providerKey: Optional[str] = None       # "telebirr" | "cbe" | ...
    resolvedUrl: Optional[str] = None
    httpStatus: Optional[int] = None
    fetchedAt: Optional[str] = None
    rawHtmlLength: Optional[int] = None
    error: Optional[str] = None
    receipt: Optional[Dict[str, Any]] = None


# ── links.et health check schemas ─────────────────────────────────────────────

class LinksETComponent(BaseModel):
    name: str
    host: str
    group: str              # "internal" | "upstream"
    status: str             # "operational" | "degraded" | "down"
    responseMs: Optional[int] = None
    httpStatus: Optional[int] = None
    error: Optional[str] = None


class LinksETHealthResponse(BaseModel):
    ok: bool
    status: str
    checkedAt: str
    cached: bool
    components: List[LinksETComponent]


class LinksETHealthFiltered(BaseModel):
    """Filtered health returned from our own GET /payments/health endpoint."""
    ok: bool
    status: str
    checkedAt: str
    components: List[LinksETComponent]  # only the 3 relevant components


# ── Output schemas ────────────────────────────────────────────────────────────

class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str              # ULID
    website_id: str      # ULID
    plan: SubscriptionPlan
    status: SubscriptionStatus
    amount: float
    currency: str
    receipt_url: Optional[str] = None
    payment_provider: Optional[str] = None
    receipt_no: Optional[str] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime


class VerifyPaymentResponse(BaseModel):
    """Returned to the frontend after successful verification."""
    subscription: SubscriptionOut
    receipt: Dict[str, Any]
    provider: str
    message: str
