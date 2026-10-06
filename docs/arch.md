# DirTera — Backend Architecture

**Version:** 0.1.0  
**Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2 (async) · Alembic · links.et

---

## Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Layer Architecture](#3-layer-architecture)
4. [Database Design](#4-database-design)
5. [Authentication & Authorisation](#5-authentication--authorisation)
6. [Taxonomy System](#6-taxonomy-system)
7. [Website Lifecycle](#7-website-lifecycle)
8. [Payment & Subscription System](#8-payment--subscription-system)
9. [Analytics System](#9-analytics-system)
10. [Notification System](#10-notification-system)
11. [Configuration & Environment](#11-configuration--environment)
12. [Alembic Migration Strategy](#12-alembic-migration-strategy)
13. [ID Strategy — ULID](#13-id-strategy--ulid)
14. [CI/CD](#14-cicd)
15. [Scalability Considerations](#15-scalability-considerations)
16. [Dependency Map](#16-dependency-map)

---

## 1. Project Overview

DirTera is a **web directory platform** for Ethiopian websites. Businesses register their sites, pay a subscription fee verified through [links.et](https://links.et), and — after admin approval — appear in a searchable, filterable public directory.

**Core actors**

| Actor | Capabilities |
|-------|-------------|
| **Visitor** | Browse listings, filter by category / domain / keyword, click through to sites |
| **Owner** | Register listings, pay subscriptions, view click analytics, receive notifications |
| **Admin** | Approve / reject listings, manage taxonomy and plans, promote to premiered, manage users |

---

## 2. Repository Layout

```
DirTera/
├── .github/
│   └── workflows/
│       ├── frontend.yml      Frontend CI (lint + build)
│       └── backend.yml       Backend CI (import check + migrations + smoke test)
│
├── docs/
│   ├── api.md               API contract — every endpoint documented
│   └── arch.md              This document
│
├── frontend/                React 19 / Vite / oxlint
│
└── backend/
    ├── .env.dev             Dev environment variables (never commit secrets)
    ├── alembic.ini
    ├── requirements.txt
    │
    ├── alembic/
    │   ├── env.py           Async-aware Alembic environment
    │   ├── script.py.mako   Migration file template
    │   └── versions/
    │       ├── 0001_initial_schema.py
    │       └── 0002_seed_categories_domains.py
    │
    └── app/
        ├── main.py          FastAPI factory, CORS, rate limiter, lifespan
        │
        ├── core/
        │   ├── config.py    Pydantic-settings — all config from env vars
        │   ├── database.py  Async engine + session factory + Base class
        │   ├── security.py  JWT create/decode (HS256)
        │   ├── deps.py      FastAPI dependency injectors (auth guards)
        │   └── limiter.py   slowapi rate limiter instance
        │
        ├── models/          SQLAlchemy ORM models
        │   ├── base.py      ULIDPrimaryKey mixin, TimestampMixin, PgEnum helper
        │   ├── user.py
        │   ├── category.py  Category + Domain
        │   ├── website.py
        │   ├── click.py
        │   ├── plan_config.py  SubscriptionPlanConfig (DB-managed plans)
        │   ├── subscription.py
        │   ├── review.py
        │   └── notification.py
        │
        ├── schemas/         Pydantic v2 request/response schemas
        │   ├── common.py    PaginatedResponse
        │   ├── auth.py      TokenResponse, RefreshRequest, GoogleCallbackRequest
        │   ├── user.py
        │   ├── category.py  CategoryOut, CategoryWithDomainsOut, DomainOut
        │   ├── website.py
        │   ├── analytics.py
        │   ├── subscription.py  PlanConfigOut, SubscriptionOut, AdminSubscriptionOut
        │   ├── review.py
        │   └── notification.py
        │
        ├── services/        Business logic — no FastAPI types imported
        │   ├── auth_service.py       Google OAuth, token refresh
        │   ├── user_service.py
        │   ├── category_service.py
        │   ├── website_service.py
        │   ├── analytics_service.py
        │   ├── image_service.py      Supabase Storage upload/delete
        │   ├── payment_service.py    Plan CRUD, receipt verification
        │   └── notification_service.py
        │
        └── api/v1/          FastAPI routers
            ├── router.py
            ├── auth.py
            ├── users.py
            ├── categories.py
            ├── websites.py
            ├── analytics.py
            ├── payments.py
            ├── notifications.py
            ├── reviews.py
            ├── admin.py
            └── legal.py
```

---

## 3. Layer Architecture

```
┌──────────────────────────────────────────────────────┐
│                  HTTP / FastAPI                       │
│             app/api/v1/*.py  (routers)                │
│  Route definition · request parsing · response shape  │
│  Auth enforcement via Depends()                       │
└──────────────────────────┬───────────────────────────┘
                           │ calls
┌──────────────────────────▼───────────────────────────┐
│                 Service Layer                         │
│              app/services/*.py                        │
│  All business logic lives here                        │
│  No FastAPI types (Request/Response) imported         │
│  Receives AsyncSession + domain objects as arguments  │
│  Raises HTTPException for domain-level errors         │
└──────────────────────────┬───────────────────────────┘
                           │ reads / writes
┌──────────────────────────▼───────────────────────────┐
│                ORM / Data Layer                       │
│              app/models/*.py                          │
│  SQLAlchemy 2.x mapped_column syntax                  │
│  ULID primary keys · TimestampMixin on all tables     │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│                  Database                             │
│    SQLite (dev / CI) · PostgreSQL / Supabase (prod)   │
│    Swap DATABASE_URL — zero code change required      │
└──────────────────────────────────────────────────────┘
```

**Design rules enforced throughout the codebase:**

- Routers call services; **services never call routers**.
- The session middleware (`get_db`) commits on success and rolls back on any exception — services call `await db.flush()` to stage changes without committing.
- Pydantic schemas are fully decoupled from ORM models — `from_attributes=True` in schemas only, no `orm_mode` on models.
- External HTTP calls (Google OAuth, links.et) are isolated inside services; routers never call `httpx` directly.
- All top-level imports are at the module level; no inline `import` statements inside route handlers.

---

## 4. Database Design

### Entity-Relationship Diagram

```
users
 │
 ├──< websites (owner_id)
 │        │
 │        ├──< click_events   (website_id)
 │        ├──< subscriptions  (website_id)
 │        ├──< reviews        (website_id)
 │        └──< notifications  (website_id, SET NULL on delete)
 │
 ├──< reviews       (author_id)
 └──< notifications (user_id)

categories
 └──< domains (category_slug)   [soft FK — string reference]

plan_configs                    [standalone — admin-managed]

websites.category_slug ──► categories.slug  [soft FK]
websites.domain_slug   ──► domains.slug     [soft FK]
```

### Table Reference

| Table | Notable columns |
|-------|-----------------|
| `users` | `email` (unique), `google_id` (unique), `hashed_password` (nullable), `is_admin`, `is_active` |
| `categories` | `slug` (unique), `name`, `icon`, `is_active`, `sort_order` |
| `domains` | `slug` (unique), `name`, `icon`, `category_slug`, `is_active`, `sort_order` |
| `websites` | `owner_id`, `category_slug`, `domain_slug`, `status`, `is_premiered`, `logo_url`, `image_urls` (comma-sep), `total_clicks`, `avg_rating`, `review_count` |
| `click_events` | `website_id`, `ip_hash` (SHA-256), `referrer`, `country_code`, `clicked_at` |
| `plan_configs` | `slug` (unique), `label`, `amount`, `currency`, `duration_days`, `is_premiered`, `receiver_name`, `receiver_phone`, `is_active` |
| `subscriptions` | `user_id`, `website_id`, `plan` (string), `receipt_url` (unique), `status`, `starts_at`, `expires_at` |
| `reviews` | `author_id` + `website_id` (unique pair), `rating` (1–5), `is_visible` |
| `notifications` | `user_id`, `website_id`, `is_read` |

All tables use ULID primary keys and `created_at` / `updated_at` timestamps.

### Key design decisions

**Soft FK for category/domain slugs**  
`websites.category_slug` is a plain `VARCHAR(100)` with no DB-level `FOREIGN KEY` constraint. Deactivating or renaming a category never cascades to break existing website rows. Slug validity is enforced at the **service layer** on write only. This is intentional — a listing should never become broken because an admin renamed a taxonomy entry.

**DB-managed plans (`plan_configs`)**  
Plans are stored in the `plan_configs` table rather than as Python enums or code constants. Admins can add, modify, and deactivate plans at runtime without any code change or migration. The `SubscriptionPlan` enum has been removed; `subscriptions.plan` is a plain string referencing `plan_configs.slug`.

**Receiver identity on plans**  
Each plan stores `receiver_name` and `receiver_phone`. Payment verification checks that the credited party on every receipt matches these values. This ties plan activation to the correct DirTera Telebirr/CBE account and prevents receipts from unrelated transfers being submitted.

**Denormalised counters on `websites`**  
`total_clicks`, `avg_rating`, and `review_count` are updated in-process on every click/review. This keeps listing queries fast without aggregate joins at read time. The `click_events` table remains the authoritative source for time-range analytics.

**Receipt URL uniqueness on `subscriptions`**  
A `UNIQUE` constraint on `receipt_url` prevents the same Telebirr/CBE receipt from activating two subscriptions. Only the URL is stored — full receipt data (payer name, account numbers) is fetched from links.et on demand and never persisted.

---

## 5. Authentication & Authorisation

### Google OAuth 2.0 — only auth method

Email/password registration and login have been removed. All user accounts are created via Google OAuth.

```
1.  Frontend calls GET /auth/google
      → Backend returns Google authorization URL

2.  Frontend redirects user to Google

3a. Browser flow: Google redirects back to GET /auth/google/callback?code=...
      → Backend exchanges code, redirects browser to frontend with tokens

3b. SPA flow: Frontend POSTs code to POST /auth/google/callback
      → Backend returns { access_token, refresh_token }

4.  Backend exchanges code for Google access_token
      POST https://oauth2.googleapis.com/token

5.  Backend fetches user profile
      GET https://www.googleapis.com/oauth2/v3/userinfo

6.  Backend finds or creates User row
      - Match by google_id first, then by email (account merge path)
      - New users are marked is_verified=true (Google verifies email)
      - Existing email-only accounts get google_id merged in

7.  Backend returns JWT tokens
```

### JWT structure

```
Access token payload:
{
  "sub":      "01HZ8QP3N7GMKR5VXYWB4C0JDE",   ← ULID string
  "type":     "access",
  "is_admin": false,
  "iat":      1700000000,
  "exp":      1700003600                         ← 60 min default
}

Refresh token payload:
{
  "sub":  "01HZ8QP3N7GMKR5VXYWB4C0JDE",
  "type": "refresh",
  "iat":  1700000000,
  "exp":  1702592000                             ← 30 days default
}
```

Algorithm: `HS256`. Signing key: `SECRET_KEY` env var. Password hashing utilities (`bcrypt`/`passlib`) have been removed since email/password auth is no longer supported.

### Dependency injection chain

```python
# Any protected route:
async def my_endpoint(user: CurrentUser, db: DBSession): ...

# CurrentUser resolves as:
HTTPBearer()              →  extracts Bearer token from Authorization header
decode_token(token)       →  validates signature + expiry (raises 401 on failure)
db.execute(select(User))  →  loads User from DB, checks is_active
→  returns User object

# AdminUser adds one more check:
require_admin(user)       →  asserts user.is_admin == True  (raises 403 if not)
```

### Role model

| Condition | Access level |
|-----------|-------------|
| No token | Public endpoints only |
| Valid token, `is_admin=False` | Authenticated user endpoints |
| Valid token, `is_admin=True` | All endpoints including admin-only |

**Bootstrapping the first admin:**
```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

After that, existing admins can promote others via `PATCH /users/{id}/admin`.

---

## 6. Taxonomy System

### Why not Python enums?

Static enums require a code change + Alembic migration to add a new value. For a live directory this means unnecessary friction — a new industry category should take seconds, not a deployment.

### DB-managed approach

```
categories table           domains table
──────────────────         ──────────────────────────────────
slug   │  name             slug         │  name         │  category_slug
───────┼──────────         ─────────────┼───────────────┼──────────────
tech   │  Technology       car_rental   │  Car Rental   │  ecommerce
health │  Health           clinic       │  Clinic       │  health
                           saas         │  SaaS         │  technology
```

**Frontend integration pattern:**
```
App startup:
  GET /categories/with-domains  → full tree for nav mega-menu

Listing form:
  Render <select> from cached category/domain slugs

Filter UI:
  Render checkboxes from cached slugs
```

### Soft vs hard delete

```
Soft delete (default)          Hard delete (?hard=true)
──────────────────────         ──────────────────────────
is_active = false              Row deleted from DB

Category disappears from       Category disappears from
GET /categories                GET /categories

Existing websites KEEP         Existing websites KEEP
their category_slug value      their category_slug string —
                               it becomes an orphan but no
                               FK error is raised (soft FK)
```

### Slug validation on write

When an owner registers or updates a listing, `category_service.validate_category_slug()` and `validate_domain_slug()` query the DB and raise `422` if the slug is not found or is inactive.

---

## 7. Website Lifecycle

```
         Owner submits listing
                  │
                  ▼
            ┌──────────┐
            │ PENDING  │◄─────────────────────────────┐
            └────┬─────┘                               │
                 │                                      │
        ┌────────┴────────┐                            │
        │                 │                             │
   Admin approves    Admin rejects                      │
        │            (sets rejection_message)           │
        │                 │                             │
        ▼                 ▼                             │
   ┌──────────┐      ┌──────────┐                      │
   │ APPROVED │      │ REJECTED │                       │
   └────┬─────┘      └──────────┘                      │
        │                 │                             │
        │          Owner notified                       │
        │          (in-app notification)                │
        │                                               │
        │  Owner edits key fields                       │
        │  (url, name, short/full_description) ─────────┘
        │
   Admin suspends
        │
        ▼
   ┌───────────┐
   │ SUSPENDED │
   └───────────┘
```

**Notification triggers**

| Event | Notification title |
|-------|--------------------|
| Admin approves listing | "Your listing was approved!" |
| Admin rejects listing | "Your listing was not approved" (includes rejection message) |

**Premiered promotion path**

```
Owner pays a premiered plan
        │
POST /payments/verify → verified OK
        │
website.is_premiered = true
        │
Listing appears first in all browse / top / multi-category
queries regardless of sort_by
```

**Image management**

Each listing supports one logo and up to three gallery images. Images are uploaded via `multipart/form-data`, processed by `image_service` (resize to max 1920px, convert to WEBP), and stored in Supabase Storage. URLs are persisted as `logo_url` (single) and `image_urls` (comma-separated list). When a listing is deleted, all its Supabase Storage objects are removed as a best-effort background cleanup.

---

## 8. Payment & Subscription System

### Sequence diagram

```
Owner          DirTera Backend            links.et
  │                   │                       │
  │── GET /payments/  │                       │
  │   plans ──────────►                       │
  │◄── PlanConfigOut[]│                       │
  │                   │                       │
  │  (user pays via   │                       │
  │   Telebirr app)   │                       │
  │                   │                       │
  │── POST /payments/ │                       │
  │   verify ─────────►                       │
  │  { website_id,    │── POST /api/verify ──►│
  │    plan,          │   { url: receipt_url }│
  │    receipt_url }  │   x-api-key: ...      │
  │                   │◄── [{ ok, receipt }] ─│
  │                   │                       │
  │                   │  validate amount      │
  │                   │  validate status      │
  │                   │  validate receiver    │
  │                   │  create Subscription  │
  │◄── VerifyPayment  │                       │
  │    Response ───────│                       │
```

### Plan configuration (DB-managed)

Plans are rows in the `plan_configs` table. The admin creates and manages them via `POST/PATCH/DELETE /payments/plans`. There are no hardcoded plan slugs or prices in the application code.

Each plan must have:
- `slug` — unique identifier used in subscription requests
- `amount` + `currency` — expected payment amount
- `duration_days` — subscription length
- `is_premiered` — whether this plan sets `website.is_premiered=true`
- `receiver_name` + `receiver_phone` — **required** for receipt validation

### Receipt validation logic

```
1. Duplicate check:  receipt_url UNIQUE constraint → 409 on reuse

2. Amount check:
   expected = plan.amount           (from DB)
   settled  = parse(receipt.settledAmount)
   if abs(settled - expected) > 1.0 → 400 Amount mismatch

3. Status check:
   if receipt.transactionStatus != "Completed" → 400

4. Receiver name check:
   plan.receiver_name must appear (case-insensitive) in
   receipt.creditedPartyName → 400 Receiver name mismatch

5. Receiver phone check (masked-phone-aware):
   plan.receiver_phone normalised to last 9 local digits
   receipt.creditedPartyAccountNo visible suffix extracted
   plan phone must END WITH that suffix → 400 Receiver phone mismatch
```

The masked-phone check handles Telebirr's `***XXXXX` masking format — only the visible trailing digits are compared against the plan phone number.

### Dev / mock mode

When `LINKSSET_API_KEY` is empty (default in `.env.dev`), `payment_service` skips the real links.et call and returns a synthetic successful receipt. This lets you test the full subscription activation flow locally without real payments.

### Double-spend protection

`subscriptions.receipt_url` has a `UNIQUE` constraint at the DB level. The service also checks for an existing row before calling links.et, so the external call is never made for a duplicate receipt.

---

## 9. Analytics System

### Data flow

```
Visitor clicks listing
        │
GET /websites/{id}/click   (rate-limited: 60/min per IP)
        │
analytics_service.record_click()
   ├── Creates ClickEvent row
   │     ip_hash:    SHA-256(client IP)   ← anonymised
   │     user_agent: truncated to 512 chars
   │     referrer:   truncated to 2048 chars
   └── Increments website.total_clicks   ← denormalised counter

Owner calls dashboard:
GET /analytics/{id}/stats    → daily time-series (respects start_date/end_date params)
GET /analytics/{id}/summary  → totals + top referrers + clicks by country
GET /analytics/{id}/export   → CSV of all click events
```

### Summary query optimisation

`get_aggregated_stats` uses **one SQL query** with conditional aggregation instead of four sequential round-trips:

```sql
SELECT
  COUNT(id)                                        AS total,
  COUNT(CASE WHEN clicked_at >= :today  THEN 1 END) AS today,
  COUNT(CASE WHEN clicked_at >= :week   THEN 1 END) AS last7,
  COUNT(CASE WHEN clicked_at >= :month  THEN 1 END) AS last30
FROM click_events
WHERE website_id = :id
```

### Date range behaviour (corrected)

`get_click_stats` now correctly respects both the `start_date` and `end_date` query parameters when provided. If omitted, `start_date` defaults to the listing's creation date (returns all-time data) and `end_date` defaults to today.

### Privacy

| Field | Treatment |
|-------|-----------|
| IP address | SHA-256 hashed before storage — original never persisted |
| User agent | Stored as-is (browser/OS info only) |
| Referrer URL | Stored as-is |
| Authenticated user | Not linked to click events — analytics are fully anonymous |

---

## 10. Notification System

Notifications are in-app messages surfaced to listing owners. Currently triggered by the approval workflow; the `notification_service.create_notification()` helper can be called from any service to add new triggers.

### Current triggers

| Trigger | Title | Body |
|---------|-------|------|
| Admin approves listing | "Your listing was approved!" | Listing name + confirmation |
| Admin rejects listing | "Your listing was not approved" | Listing name + rejection message |

### Schema

```
notifications
  user_id    → FK → users.id   (CASCADE delete)
  website_id → FK → websites.id (SET NULL on delete)
  title      VARCHAR(255)
  body       TEXT
  is_read    BOOLEAN  default false
```

### Read state management

- `PATCH /notifications/read-all` — bulk marks all unread as read
- `PATCH /notifications/{id}/read` — marks a single notification as read
- `GET /notifications?unread_only=true` — badge count / unread-only view

---

## 11. Configuration & Environment

All configuration is read from environment variables via `pydantic-settings`. The single most important variable is `DATABASE_URL`.

### Switching databases

| Database | `DATABASE_URL` value |
|----------|----------------------|
| SQLite (dev / CI) | `sqlite+aiosqlite:///./dirterra.db` |
| PostgreSQL | `postgresql+asyncpg://user:pass@host:5432/db` |
| Supabase | `postgresql+asyncpg://postgres:[pass]@db.[ref].supabase.co:5432/postgres` |

No code changes required — set the env var and run `alembic upgrade head`.

### Key environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT signing key — `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Yes | SQLAlchemy async connection string |
| `GOOGLE_CLIENT_ID` | Yes | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Yes | Must match Google Console setting exactly |
| `LINKSSET_API_KEY` | Prod | From links.et dashboard — leave blank in dev for mock mode |
| `ALLOWED_ORIGINS` | Yes | Comma-separated or JSON array of frontend URLs for CORS |
| `SUPABASE_URL` | Prod | For image storage |
| `SUPABASE_SECRET_KEY` | Prod | For image storage |
| `RATE_LIMIT_ENABLED` | — | Set `false` in CI/test environments |

---

## 12. Alembic Migration Strategy

### Running migrations

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Check current revision
alembic current

# Generate a new migration after model changes
alembic revision --autogenerate -m "add_xyz_column"

# Roll back one step
alembic downgrade -1
```

### Async support

`alembic/env.py` uses `async_engine_from_config` and `run_sync` to bridge the synchronous Alembic API with the async SQLAlchemy engine. This works across all supported drivers (aiosqlite, asyncpg).

### Migration naming convention

```
0001_initial_schema.py           ← all tables created
0002_seed_categories_domains.py  ← default taxonomy rows
0003_add_xyz.py                  ← future incremental changes
```

### Seed migration idempotency

The seed migration uses `INSERT ... ON CONFLICT (slug) DO NOTHING` so it can be re-run safely against a populated database without duplicating rows.

---

## 13. ID Strategy — ULID

All primary keys use **ULID** (Universally Unique Lexicographically Sortable Identifier), stored as `CHAR(26)`.

| Property | UUID4 | ULID |
|----------|-------|------|
| Sortable by creation time | No | Yes — first 48 bits are millisecond timestamp |
| Index locality (new rows cluster) | Poor | Good |
| URL-safe (no hyphens) | No | Yes |
| Length | 36 chars | 26 chars |
| Sequential enumeration risk | Low | None |

ULID generation happens in Python at insert time via `python-ulid`, not in the database. The application always knows the ID before the row is committed — useful for logging and response building.

```python
# app/models/base.py
class ULIDPrimaryKey:
    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=lambda: str(ULID()),
    )
```

---

## 14. CI/CD

### GitHub Actions workflows

| Workflow | File | Trigger |
|----------|------|---------|
| Frontend CI | `.github/workflows/frontend.yml` | Push/PR to `main`/`master` touching `frontend/**` |
| Backend CI | `.github/workflows/backend.yml` | Push/PR to `main`/`master` touching `backend/**` |

Both workflows use **path filters** — a frontend change does not trigger the backend pipeline and vice versa.

### Frontend CI steps

```
1. actions/setup-node@v4  (Node 20, npm cache)
2. npm ci
3. npm run lint            (oxlint)
4. npm run build           (Vite production build)
```

### Backend CI steps

```
1. actions/setup-python@v5  (Python 3.11, pip cache)
2. pip install -r requirements.txt
3. python -c "from app.main import app"   ← catches broken imports immediately
4. alembic upgrade head                   ← runs migrations against fresh SQLite DB
5. uvicorn app.main:app &
   curl /health → assert status == "ok"  ← smoke-test: server starts and responds
```

The CI environment sets `RATE_LIMIT_ENABLED=false`, `DATABASE_URL=sqlite+aiosqlite:///./ci_test.db`, and stub values for all external service credentials so no real OAuth or payment calls are made.

### Status badges

README.md displays live pass/fail badges linked to the latest run on `main`:

```md
[![Frontend CI](https://github.com/Uno-stark/DirTera/actions/workflows/frontend.yml/badge.svg)](...)
[![Backend CI](https://github.com/Uno-stark/DirTera/actions/workflows/backend.yml/badge.svg)](...)
```

---

## 15. Scalability Considerations

### Current design (single server)

Designed for a single application server and one database — appropriate for initial launch.

### Horizontal scaling path

| Concern | Current | Scale-up path |
|---------|---------|---------------|
| DB connections | Single async pool | PgBouncer in front of Postgres |
| Session state | Stateless JWT | Already stateless — no change needed |
| Click events | Synchronous DB insert | Buffer in Redis, flush in background batches |
| File uploads | Supabase Storage | Already cloud-hosted — scales independently |
| Search | SQL `ILIKE` | PostgreSQL `tsvector` + `GIN` index or Meilisearch |
| Taxonomy caching | No cache | Redis cache for `/categories/with-domains`, `/payments/plans` |

### PostgreSQL-specific upgrades (when ready)

| Feature | How |
|---------|-----|
| Full-text search on name/description/tags | `tsvector` column + `GIN` index + `to_tsquery` |
| Tag array filtering | `tags TEXT[]` + `GIN` index + `@>` operator |
| Partitioned click_events | Partition by `clicked_at` month for fast range queries |

---

## 16. Dependency Map

```
app/main.py
 └── app/api/v1/router.py
      ├── auth.py          → auth_service     → security, models/user
      ├── users.py         → user_service     → models/user
      ├── categories.py    → category_service → models/category
      ├── websites.py      → website_service  → models/website
      │                       category_service (slug validation)
      │                       notification_service
      │                    → analytics_service → models/click
      │                    → image_service     → Supabase Storage
      ├── analytics.py     → analytics_service → models/click, website
      ├── payments.py      → payment_service  → models/subscription, plan_config
      │                       httpx (links.et verify + status)
      ├── notifications.py → notification_service → models/notification
      ├── reviews.py       → models/review (inline, no service layer)
      ├── admin.py         → models/user, website, category, subscription, plan_config
      └── legal.py         → static content (no service, no DB)

All routers depend on:
  app/core/deps.py     → get_current_user / require_admin / get_db
  app/core/database.py → AsyncSession
  app/core/config.py   → Settings
```

### External dependencies

| Service | Used by | Purpose |
|---------|---------|---------|
| Google OAuth 2.0 | `auth_service` | User login — only auth method |
| links.et `/api/verify` | `payment_service` | Parse and verify Telebirr/CBE receipts |
| links.et `/api/status` | `payment_service` | Health check proxy |
| Supabase Storage | `image_service` | Website logo and gallery image hosting |

All external HTTP calls use `httpx.AsyncClient` with explicit timeouts. Network errors are caught and re-raised as `503 Service Unavailable`.
