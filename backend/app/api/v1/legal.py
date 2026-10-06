"""
Legal endpoints — Terms of Service and Privacy Policy.

GET /legal/terms    → Terms of Service
GET /legal/privacy  → Privacy Policy

These return structured JSON so the frontend can render them dynamically
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter

router = APIRouter(prefix="/legal", tags=["Legal"])

# ── Content ────────────────────────────────────────────────────────────────────
# Edit the text fields below to reflect your actual policies.
# `effective_date` should be updated whenever content changes.

_TERMS = {
    "title": "Terms of Service",
    "effective_date": str(date(2026, 10, 1)),
    "version": "1.0",
    "sections": [
        {
            "heading": "1. Acceptance of Terms",
            "body": (
                "By accessing or using DirTera ('the Platform'), you agree to be bound "
                "by these Terms of Service. If you do not agree, do not use the Platform."
            ),
        },
        {
            "heading": "2. Description of Service",
            "body": (
                "DirTera is an online directory platform that allows businesses and "
                "individuals to register their websites and be discovered by users. "
                "All listings are subject to admin review before appearing publicly."
            ),
        },
        {
            "heading": "3. Listing Registration",
            "body": (
                "To register a listing you must create an account, provide accurate "
                "information, and pay the applicable subscription fee. Listings that "
                "violate our content guidelines will be rejected or removed."
            ),
        },
        {
            "heading": "4. Subscription and Payments",
            "body": (
                "Subscription fees are non-refundable once a payment receipt has been "
                "verified. All payments are processed via Ethiopian payment providers "
                "(Telebirr, CBE, etc.) through the links.et receipt verification system. "
                "DirTera does not store full payment receipts or payer account details."
            ),
        },
        {
            "heading": "5. Prohibited Content",
            "body": (
                "You may not register listings that are illegal, fraudulent, misleading, "
                "or harmful. DirTera reserves the right to reject or remove any listing "
                "at its sole discretion without refund."
            ),
        },
        {
            "heading": "6. Intellectual Property",
            "body": (
                "You retain ownership of the content you submit. By submitting a listing "
                "you grant DirTera a non-exclusive, worldwide licence to display that "
                "content on the Platform."
            ),
        },
        {
            "heading": "7. Limitation of Liability",
            "body": (
                "DirTera is provided 'as is'. We are not liable for any indirect, "
                "incidental, or consequential damages arising from your use of the Platform."
            ),
        },
        {
            "heading": "8. Changes to Terms",
            "body": (
                "We may update these Terms at any time. Continued use of the Platform "
                "after changes are posted constitutes acceptance of the revised Terms."
            ),
        },
        {
            "heading": "9. Contact",
            "body": (
                "For questions about these Terms, contact us."
            ),
        },
    ],
}

_PRIVACY = {
    "title": "Privacy Policy",
    "effective_date": str(date(2026, 10, 1)),
    "version": "1.0",
    "sections": [
        {
            "heading": "1. Information We Collect",
            "body": (
                "We collect the information you provide when you register an account "
                "(email address, full name) and when you submit a listing (business name, "
                "description, category, contact details). "
                "When you authenticate via Google, we receive your Google profile "
                "information (name, email, profile picture) as permitted by your Google "
                "account settings."
            ),
        },
        {
            "heading": "2. Click Analytics",
            "body": (
                "When a visitor clicks a listing, we record an anonymised click event. "
                "The visitor's IP address is hashed (SHA-256) before storage — the raw "
                "IP is never persisted. We also record the referring URL and browser "
                "user-agent. No personally identifiable information is stored in click "
                "events."
            ),
        },
        {
            "heading": "3. Payment Data",
            "body": (
                "We store only the receipt URL submitted for payment verification. "
                "Full receipt content (payer name, account numbers) is fetched from "
                "links.et on demand and is never stored in our database. "
                "We verify the credited party matches our registered merchant account "
                "to prevent fraud."
            ),
        },
        {
            "heading": "4. Public Information",
            "body": (
                "Approved listings are visible to the public. The listing's destination "
                "URL is never exposed in API responses — it is only accessed via a "
                "click-redirect endpoint that records analytics and forwards the visitor. "
                "Owner email addresses, phone numbers, and social links are not "
                "visible to the public."
            ),
        },
        {
            "heading": "5. How We Use Your Information",
            "body": (
                "We use your information to operate the Platform, process listing "
                "registrations, verify payments, send in-app notifications, and "
                "provide click analytics to listing owners."
            ),
        },
        {
            "heading": "6. Data Sharing",
            "body": (
                "We do not sell your personal data. We share data only with: "
                "(a) links.et, to verify payment receipts; "
                "(b) Google, for OAuth authentication; "
                "(c) our hosting provider (Supabase), where data is stored. "
                "All providers are contractually required to protect your data."
            ),
        },
        {
            "heading": "7. Data Retention",
            "body": (
                "Account data is retained while your account is active. "
                "You may request deletion of your account and associated data "
                "by contacting us. "
                "Click event data is retained for up to 2 years for analytics purposes."
            ),
        },
        {
            "heading": "8. Your Rights",
            "body": (
                "You have the right to access, correct, or delete your personal data. "
                "To exercise these rights, contact us."
            ),
        },
        {
            "heading": "9. Cookies",
            "body": (
                "We do not use tracking cookies. Authentication tokens are stored in "
                "your browser's localStorage and are never shared with third parties."
            ),
        },
        {
            "heading": "10. Changes to This Policy",
            "body": (
                "We may update this Privacy Policy. The effective date at the top of "
                "this document reflects the most recent revision."
            ),
        },
        {
            "heading": "11. Contact",
            "body": (
                "For privacy questions, contact us."
            ),
        },
    ],
}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/terms", summary="Terms of Service")
async def terms_of_service():
    """Returns the DirTera Terms of Service as structured JSON."""
    return _TERMS


@router.get("/privacy", summary="Privacy Policy")
async def privacy_policy():
    """Returns the DirTera Privacy Policy as structured JSON."""
    return _PRIVACY
