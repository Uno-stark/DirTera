from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.subscription import SubscriptionPlan, SubscriptionStatus


# ── Plan config schemas (admin-managed) ───────────────────────────────────────

class PlanConfigCreate(BaseModel):
    slug: str = Field(..., pattern=r"^[a-z0-9_]+$", description="Lowercase slug, e.g. 'basic'")
    label: str
    description: Optional[str] = None
    amount: float = Field(..., gt=0)
    currency: str = "ETB"
    duration_days: int = Field(..., gt=0)
    is_premiered: bool = False
    is_active: bool = True
    sort_order: int = 0
    # Receiver identity — REQUIRED. Used to validate the credited party on
    # every receipt. Without these fields the plan cannot be activated.
    receiver_name: str = Field(
        ...,
        description="Full name of the DirTera Telebirr / CBE account that receives payment ",
    )
    receiver_phone: str = Field(
        ...,
        description="Phone number of the receiving account in any Ethiopian format ",
    )


class PlanConfigUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    duration_days: Optional[int] = Field(None, gt=0)
    is_premiered: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None


class PlanConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    label: str
    description: Optional[str] = None
    amount: float
    currency: str
    duration_days: int
    is_premiered: bool
    is_active: bool
    sort_order: int
    receiver_name: str
    receiver_phone: str
    created_at: datetime
    updated_at: datetime


# ── Request schemas ────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    """Plan selection before the user goes to pay."""
    website_id: str      # ULID
    plan: str            # plan slug


class VerifyPaymentRequest(BaseModel):
    """
    Submitted by the frontend after the user has completed payment.
    The user provides their receipt URL (Telebirr / CBE / etc.).
    """
    website_id: str      # ULID
    plan: str            # plan slug
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
    settledAmount: Optional[str] = None     
    serviceFee: Optional[str] = None
    serviceFeeVAT: Optional[str] = None
    totalPaidAmount: Optional[str] = None
    paymentReason: Optional[str] = None
    paymentMode: Optional[str] = None
    paymentChannel: Optional[str] = None


class LinksETVerifyResponse(BaseModel):
    """Single element from the links.et /api/verify response array."""
    ok: bool
    providerKey: Optional[str] = None     
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
    components: List[LinksETComponent]  


# ── Output schemas ────────────────────────────────────────────────────────────

class AdminSubscriptionOut(BaseModel):
    """Flat subscription row returned by the admin subscriptions list endpoint."""
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    website_id: str
    plan: str
    amount: float
    currency: str
    status: SubscriptionStatus
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str              # ULID
    website_id: str      # ULID
    plan: str            # plan slug
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
