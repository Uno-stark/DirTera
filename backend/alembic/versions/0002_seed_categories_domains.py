"""Seed default categories and domains

Revision ID: 0002
Revises: 0001
Create Date: 2026-01-01 00:01:00

Inserts the initial taxonomy data.
Running this migration is idempotent — it uses INSERT OR IGNORE (SQLite)
or INSERT ... ON CONFLICT DO NOTHING (PostgreSQL) so re-running is safe.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Seed data ──────────────────────────────────────────────────────────────────
# (id values are fixed short strings so they are deterministic across envs)

CATEGORIES = [
    # slug              name                    icon  sort
    ("technology",      "Technology",           "",  0),
    ("health",          "Health",               "",  1),
    ("finance",         "Finance",              "",  2),
    ("education",       "Education",            "",  3),
    ("ecommerce",       "E-Commerce",           "",  4),
    ("food",            "Food & Beverage",      "",  5),
    ("travel",          "Travel & Tourism",     "",  6),
    ("real_estate",     "Real Estate",          "",  7),
    ("entertainment",   "Entertainment",        "",  8),
    ("news",            "News & Media",         "",  9),
    ("sports",          "Sports",               "",  10),
    ("government",      "Government",           "",  11),
    ("ngo",             "NGO & Non-Profit",     "",  12),
    ("other",           "Other",                "",  99),
]

# (slug, name, icon, sort_order, parent_category_slug)
DOMAINS = [
    # ── Technology ────────────────────────────────────────────────────────────
    ("software",            "Software",                 "",  0,  "technology"),
    ("saas",                "SaaS",                     "",  1,  "technology"),
    ("cybersecurity",       "Cybersecurity",            "",  2,  "technology"),
    ("ai_ml",               "AI & Machine Learning",    "",  3,  "technology"),
    ("hardware",            "Hardware",                 "",  4,  "technology"),
    ("telecom",             "Telecom",                  "",  5,  "technology"),

    # ── Health ────────────────────────────────────────────────────────────────
    ("hospital",            "Hospital",                 "",  0,  "health"),
    ("clinic",              "Clinic",                   "",  1,  "health"),
    ("pharmacy",            "Pharmacy",                 "",  2,  "health"),
    ("fitness",             "Fitness & Gym",            "",  3,  "health"),
    ("mental_health",       "Mental Health",            "",  4,  "health"),

    # ── Finance ───────────────────────────────────────────────────────────────
    ("banking",             "Banking",                  "",  0,  "finance"),
    ("microfinance",        "Microfinance",             "",  1,  "finance"),
    ("investment",          "Investment",               "",  2,  "finance"),
    ("insurance",           "Insurance",                "",  3,  "finance"),
    ("remittance",          "Remittance",               "",  4,  "finance"),

    # ── Education ─────────────────────────────────────────────────────────────
    ("university",          "University",               "",  0,  "education"),
    ("school",              "School",                   "",  1,  "education"),
    ("online_learning",     "Online Learning",          "",  2,  "education"),
    ("tutoring",            "Tutoring",                 "",  3,  "education"),

    # ── E-Commerce ────────────────────────────────────────────────────────────
    ("grocery",             "Grocery",                  "",  0,  "ecommerce"),
    ("fashion",             "Fashion",                  "",  1,  "ecommerce"),
    ("electronics",         "Electronics",              "",  2,  "ecommerce"),
    ("furniture",           "Furniture",                "",  3,  "ecommerce"),
    ("automotive",          "Automotive",               "",  4,  "ecommerce"),
    ("car_rental",          "Car Rental",               "",  5,  "ecommerce"),
    ("fuel",                "Fuel & Gas",               "",  6,  "ecommerce"),

    # ── Food & Beverage ───────────────────────────────────────────────────────
    ("restaurant",          "Restaurant",               "",  0,  "food"),
    ("cafe",                "Café",                     "",  1,  "food"),
    ("catering",            "Catering",                 "",  2,  "food"),
    ("food_delivery",       "Food Delivery",            "",  3,  "food"),

    # ── Travel ────────────────────────────────────────────────────────────────
    ("hotel",               "Hotel",                    "",  0,  "travel"),
    ("resort",              "Resort",                   "",  1,  "travel"),
    ("tour_operator",       "Tour Operator",            "",  2,  "travel"),
    ("events",              "Events & Venues",          "",  3,  "travel"),

    # ── Real Estate ───────────────────────────────────────────────────────────
    ("residential",         "Residential",              "",  0,  "real_estate"),
    ("commercial",          "Commercial",               "",  1,  "real_estate"),
    ("property_management", "Property Management",      "",  2,  "real_estate"),

    # ── Entertainment ─────────────────────────────────────────────────────────
    ("video",               "Video & Streaming",        "",  0,  "entertainment"),
    ("podcast",             "Podcast",                  "",  1,  "entertainment"),
    ("blog",                "Blog",                     "",  2,  "entertainment"),

    # ── News & Media ──────────────────────────────────────────────────────────
    ("newspaper",           "Newspaper",                "",  0,  "news"),
    ("magazine",            "Magazine",                 "",  1,  "news"),

    # ── Government ────────────────────────────────────────────────────────────
    ("federal",             "Federal Government",       "",  0,  "government"),
    ("regional",            "Regional / City",          "",  1,  "government"),
    ("embassy",             "Embassy / Consulate",      "",  2,  "government"),

    # ── NGO ───────────────────────────────────────────────────────────────────
    ("charity",             "Charity & Donations",      "",  0,  "ngo"),
    ("community",           "Community Organisation",   "",  1,  "ngo"),

    # ── Professional services (cross-category) ────────────────────────────────
    ("law",                 "Law Firm",                 "",  0,  "other"),
    ("accounting",          "Accounting",               "",  1,  "other"),
    ("consulting",          "Consulting",               "",  2,  "other"),
    ("marketing",           "Marketing & Advertising",  "",  3,  "other"),
    ("recruitment",         "Recruitment & HR",         "", 4,  "other"),

    ("other",               "Other",                    "",  99, "other"),
]


def _upsert_categories(conn) -> None:
    """Insert categories, skip on conflict (idempotent)."""
    from ulid import ULID
    for slug, name, icon, sort_order in CATEGORIES:
        conn.execute(
            text(
                "INSERT INTO categories (id, slug, name, icon, sort_order, is_active, "
                "created_at, updated_at) "
                "VALUES (:id, :slug, :name, :icon, :sort_order, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            {"id": str(ULID()), "slug": slug, "name": name, "icon": icon, "sort_order": sort_order},
        )


def _upsert_domains(conn) -> None:
    """Insert domains, skip on conflict (idempotent)."""
    from ulid import ULID
    for slug, name, icon, sort_order, cat_slug in DOMAINS:
        conn.execute(
            text(
                "INSERT INTO domains (id, slug, name, icon, sort_order, category_slug, "
                "is_active, created_at, updated_at) "
                "VALUES (:id, :slug, :name, :icon, :sort_order, :cat_slug, 1, "
                "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            {
                "id": str(ULID()),
                "slug": slug,
                "name": name,
                "icon": icon,
                "sort_order": sort_order,
                "cat_slug": cat_slug,
            },
        )


def upgrade() -> None:
    conn = op.get_bind()
    _upsert_categories(conn)
    _upsert_domains(conn)


def downgrade() -> None:
    conn = op.get_bind()
    # Remove only the seeded rows; leave anything admins added manually
    seeded_category_slugs = [r[0] for r in CATEGORIES]
    seeded_domain_slugs   = [r[0] for r in DOMAINS]

    conn.execute(
        text(f"DELETE FROM domains WHERE slug IN ({','.join(':s'+str(i) for i in range(len(seeded_domain_slugs)))})")
        if seeded_domain_slugs else text("SELECT 1"),
        {f"s{i}": s for i, s in enumerate(seeded_domain_slugs)},
    )
    conn.execute(
        text(f"DELETE FROM categories WHERE slug IN ({','.join(':s'+str(i) for i in range(len(seeded_category_slugs)))})")
        if seeded_category_slugs else text("SELECT 1"),
        {f"s{i}": s for i, s in enumerate(seeded_category_slugs)},
    )
