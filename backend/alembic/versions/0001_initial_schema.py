from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("google_id", sa.String(255), nullable=True),
        sa.Column("is_admin", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("google_id", name="uq_users_google_id"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_google_id", "users", ["google_id"])

    # ── categories ────────────────────────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("icon", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_categories_slug"),
    )
    op.create_index("ix_categories_slug", "categories", ["slug"])

    # ── domains ───────────────────────────────────────────────────────────────
    op.create_table(
        "domains",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("icon", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("category_slug", sa.String(100), sa.ForeignKey("categories.slug", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_domains_slug"),
    )
    op.create_index("ix_domains_slug", "domains", ["slug"])
    op.create_index("ix_domains_category_slug", "domains", ["category_slug"])

    # ── websites ──────────────────────────────────────────────────────────────
    op.create_table(
        "websites",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("owner_id", sa.String(26), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("short_description", sa.String(500), nullable=False),
        sa.Column("full_description", sa.Text, nullable=True),
        sa.Column("thumbnail_url", sa.Text, nullable=True),
        sa.Column("logo_url", sa.Text, nullable=True),
        sa.Column("category_slug", sa.String(100), nullable=True),
        sa.Column("domain_slug", sa.String(100), nullable=True),
        sa.Column("tags", sa.String(1000), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("social_links", sa.Text, nullable=True),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", "suspended", name="websitestatus"), nullable=False, server_default="pending"),
        sa.Column("rejection_message", sa.Text, nullable=True),
        sa.Column("reviewed_by_id", sa.String(26), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("is_premiered", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("linksset_subscription_id", sa.String(255), nullable=True),
        sa.Column("total_clicks", sa.Integer, nullable=False, server_default="0"),
        sa.Column("avg_rating", sa.Float, nullable=False, server_default="0"),
        sa.Column("review_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("url", name="uq_websites_url"),
    )
    op.create_index("ix_websites_owner_id", "websites", ["owner_id"])
    op.create_index("ix_websites_status", "websites", ["status"])
    op.create_index("ix_websites_is_premiered", "websites", ["is_premiered"])
    op.create_index("ix_websites_category_slug", "websites", ["category_slug"])
    op.create_index("ix_websites_domain_slug", "websites", ["domain_slug"])

    # ── click_events ──────────────────────────────────────────────────────────
    op.create_table(
        "click_events",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("website_id", sa.String(26), sa.ForeignKey("websites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("referrer", sa.String(2048), nullable=True),
        sa.Column("country_code", sa.String(4), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_click_events_website_id", "click_events", ["website_id"])
    op.create_index("ix_click_events_clicked_at", "click_events", ["clicked_at"])

    # ── subscriptions ─────────────────────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(26), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("website_id", sa.String(26), sa.ForeignKey("websites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan", sa.Enum("basic", "standard", "premium", "premiered", name="subscriptionplan"), nullable=False, server_default="basic"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="ETB"),
        sa.Column("status", sa.Enum("pending", "active", "expired", "cancelled", "failed", name="subscriptionstatus"), nullable=False, server_default="pending"),
        sa.Column("receipt_url", sa.Text, nullable=True),
        sa.Column("payment_provider", sa.String(50), nullable=True),
        sa.Column("receipt_no", sa.String(100), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("receipt_url", name="uq_subscriptions_receipt_url"),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_website_id", "subscriptions", ["website_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
    op.create_index("ix_subscriptions_receipt_no", "subscriptions", ["receipt_no"])
    op.create_index("ix_subscriptions_expires_at", "subscriptions", ["expires_at"])

    # ── reviews ───────────────────────────────────────────────────────────────
    op.create_table(
        "reviews",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("author_id", sa.String(26), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("website_id", sa.String(26), sa.ForeignKey("websites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("is_visible", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("author_id", "website_id", name="uq_review_author_website"),
    )
    op.create_index("ix_reviews_author_id", "reviews", ["author_id"])
    op.create_index("ix_reviews_website_id", "reviews", ["website_id"])

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(26), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(26), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("website_id", sa.String(26), sa.ForeignKey("websites.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("reviews")
    op.drop_table("subscriptions")
    op.drop_table("click_events")
    op.drop_table("websites")
    op.drop_table("domains")
    op.drop_table("categories")
    op.drop_table("users")
