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
11. [Configuration & Database Portability](#11-configuration--database-portability)
12. [Alembic Migration Strategy](#12-alembic-migration-strategy)
13. [ID Strategy — ULID](#13-id-strategy--ulid)
14. [Scalability Considerations](#14-scalability-considerations)
15. [Dependency Map](#15-dependency-map)

---

## 1. Project Overview

DirTera is a **web directory platform** for Ethiopian websites. Businesses register their sites, pay a subscription fee verified through [links.et](https://links.et), and — after admin approval — appear in a searchable, filterable public directory.

**Core actors**

| Actor | Capabilities |
|-------|-------------|
| **Visitor** | Browse listings, filter by category / domain / keyword, click through to sites |
| **Owner** | Register listings, pay subscriptions, view click analytics, receive notifications |
| **Admin** | Approve / reject listings, manage taxonomy, promote to premiered, manage users |

---

## 2. Repository Layout

```
DirTera/
├── docs/
│   ├── api.md               API contract — every endpoint documented
│   └── arch.md              This document
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
    │       ├── 0001_initial_schema.py         All tables
    │       └── 0002_seed_categories_domains.py  Default taxonomy rows
    │
    └── app/
        ├── main.py          FastAPI factory, CORS, lifespan
        │
        ├── core/
        │   ├── config.py    Pydantic-settings — all config from env vars
        │   ├── database.py  Async engine + session factory + Base class
        │   ├── security.py  JWT create/decode, bcrypt hash/verify
        │   └── deps.py      FastAPI dependency injectors (auth guards)
        │
        ├── models/          SQLAlchemy ORM models (one file per entity)
        │   ├── base.py      ULIDPrimaryKey mixin, TimestampMixin
        │   ├── user.py
        │   ├── category.py  Category + Domain
        │   ├── website.py
        │   ├── click.py
        │   ├── subscription.py
        │   ├── review.py
        │   └── notification.py
        │
        ├── schemas/         Pydantic v2 request/response schemas
        │   ├── common.py    PaginatedResponse, MessageResponse
        │   ├── auth.py
        │   ├── user.py
        │   ├── category.py
        │   ├── website.py
        │   ├── analytics.py
        │   ├── subscription.py
        │   ├── review.py
        │   └── notification.py
        │
        ├── services/        Business logic — no FastAPI types imported
        │   ├── auth_service.py
        │   ├── user_service.py
        │   ├── category_service.py
        │   ├── website_service.py
        │   ├── analytics_service.py
        │   ├── payment_service.py
        │   └── notification_service.py
        │
        └── api/v1/          FastAPI routers
            ├── router.py    Aggregates all routers under /api/v1
            ├── auth.py
            ├── users.py
            ├── categories.py
            ├── websites.py
            ├── analytics.py
            ├── payments.py
            ├── notifications.py
            ├── reviews.py
            └── admin.py
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
│    SQLite (dev) · PostgreSQL · Supabase               │
│    Swap DATABASE_URL — zero code change required      │
└──────────────────────────────────────────────────────┘
```

**Design rules enforced throughout the codebase:**

- Routers call services; **services never call routers**.
- The session middleware (`get_db` dependency) commits on success and rolls back on any exception — services call `await db.flush()` to stage changes without committing.
- Pydantic schemas are fully decoupled from SQLAlchemy models — no `orm_mode` coupling in models, only `from_attributes=True` in schemas.
- External HTTP calls (Google OAuth, links.et) are isolated inside services; routers never call `httpx` directly.

---

## 4. Database Design

### Entity-Relationship Diagram

```
users
 │
 ├──< websites (owner_id)
 │        │
 │        ├──< click_events (website_id)
 │        ├──< subscriptions (website_id)
 │        ├──< reviews (website_id)
 │        └──< notifications (website_id)  [SET NULL on delete]
 │
 ├──< reviews (author_id)
 └──< notifications (user_id)

categories
 └──< domains (category_slug)   [soft FK — string reference]

websites.category_slug  ──► categories.slug   [soft FK]
websites.domain_slug    ──► domains.slug       [soft FK]
```

### Table Reference

| Table | PK type | Notable columns |
|-------|---------|-----------------|
| `users` | ULID | `email` (unique), `google_id` (unique), `is_admin`, `is_active` |
| `categories` | ULID | `slug` (unique), `name`, `icon`, `is_active`, `sort_order` |
| `domains` | ULID | `slug` (unique), `name`, `icon`, `category_slug`, `is_active`, `sort_order` |
| `websites` | ULID | `owner_id`, `category_slug`, `domain_slug`, `status`, `is_premiered`, `total_clicks`, `avg_rating` |
| `click_events` | ULID | `website_id`, `ip_hash` (SHA-256), `referrer`, `country_code`, `clicked_at` |
| `subscriptions` | ULID | `receipt_url` (unique), `plan`, `status`, `expires_at` |
| `reviews` | ULID | `author_id` + `website_id` (unique pair), `rating` (1–5) |
| `notifications` | ULID | `user_id`, `website_id`, `is_read` |

### Key design decisions

**Soft FK for category/domain slugs**  
`websites.category_slug` is a plain `VARCHAR(100)` — no `FOREIGN KEY` DB constraint. This means deactivating or renaming a category never cascades to break existing website rows. Slug validity is enforced at the **service layer** on write. Existing listings simply retain the old slug value, which remains readable in the response.

**Denormalised counters on `websites`**  
`total_clicks`, `avg_rating`, and `review_count` are updated in-process on every click/review. This keeps listing queries (`SELECT * FROM websites ORDER BY ...`) fast without aggregate joins. The `click_events` table remains the authoritative source for time-range analytics.

**Receipt URL uniqueness on `subscriptions`**  
A `UNIQUE` constraint on `receipt_url` prevents the same Telebirr/CBE receipt from activating two subscriptions. Only the URL is stored — full receipt data (payer name, account numbers) is never persisted; it is re-fetchable from links.et on demand.

---

## 5. Authentication & Authorisation

### Google OAuth 2.0 Flow

```
1.  Frontend calls GET /auth/google
      → Backend returns the Google authorization URL

2.  Frontend redirects user to Google

3.  Google redirects back with ?code=...
    Frontend POSTs code to POST /auth/google/callback

4.  Backend exchanges code for Google access_token
      POST https://oauth2.googleapis.com/token

5.  Backend fetches user profile
      GET https://www.googleapis.com/oauth2/v3/userinfo

6.  Backend finds or creates User row
      - Match by google_id first, then by email (merge path)
      - New users are marked is_verified=true (Google email already verified)

7.  Backend returns { access_token, refresh_token }
```

### JWT Structure

```
Access token payload:
{
  "sub":      "01HZ8QP3N7GMKR5VXYWB4C0JDE",   ← ULID
  "type":     "access",
  "is_admin": false,
  "iat":      1700000000,
  "exp":      1700003600                         ← 60 min
}

Refresh token payload:
{
  "sub":  "01HZ8QP3N7GMKR5VXYWB4C0JDE",
  "type": "refresh",
  "iat":  1700000000,
  "exp":  1702592000                             ← 30 days
}
```

Algorithm: `HS256`. Signing key: `SECRET_KEY` in `.env`.

### Dependency Injection Chain

```python
# In any router:
async def my_endpoint(user: CurrentUser, db: DBSession): ...

# CurrentUser resolves as:
oauth2_scheme         →  extracts Bearer token from header
decode_token(token)   →  validates signature + expiry
db.execute(select(User).where(User.id == sub))
→  loads User from DB, checks is_active
→  returns User object  (or raises 401)

# AdminUser adds one more check:
require_admin(user)   →  asserts user.is_admin == True  (or raises 403)
```

### Role Model

| Condition | Access level |
|-----------|-------------|
| No token | Public endpoints only |
| Valid token, `is_admin=False` | Authenticated user endpoints |
| Valid token, `is_admin=True` | All endpoints including admin-only |

**Bootstrapping the first admin:**
```sql
UPDATE users SET is_admin = 1 WHERE email = 'admin@example.com';
```
After that, existing admins can promote others via `PATCH /users/{id}/admin`.

---

## 6. Taxonomy System

### Why not Python enums?

Static enums require a code change + Alembic migration to add a new value. For a growing directory platform this creates unnecessary friction — a new industry category should be addable in seconds, not minutes.

### DB-managed approach

```
categories table          domains table
──────────────────        ──────────────────────────────
slug  │  name             slug         │  name        │  category_slug
──────┼──────────         ─────────────┼──────────────┼──────────────
tech  │  Technology       car_rental   │  Car Rental  │  ecommerce
food  │  Food             clinic       │  Clinic      │  health
                          saas         │  SaaS        │  technology
```

**Frontend integration pattern:**
```
1. App startup: GET /categories → cache list in state
2. App startup: GET /domains   → cache list in state
3. Listing form: render <select> from cached slugs
4. Filter UI:   render checkboxes from cached slugs
```

### Soft vs Hard Delete

```
Soft delete (default)          Hard delete (?hard=true)
──────────────────────         ──────────────────────────
is_active = false              Row deleted from DB
                               
Category disappears from       Category disappears from
GET /categories                GET /categories
                               
Existing websites KEEP their   Existing websites KEEP their
category_slug value — they     category_slug string value —
just won't match active-only   it's an orphan string but no
filter queries                 FK error is raised
```

### Validation on write

When an owner registers or updates a listing, `category_service.validate_category_slug()` and `validate_domain_slug()` query the DB and raise `422` if the slug is not found or not active. This ensures no listing can ever reference a non-existent taxonomy value.

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

**Notification triggers:**

| Event | Notification title |
|-------|--------------------|
| Admin approves listing | "Your listing was approved!" |
| Admin rejects listing | "Your listing was not approved" (includes rejection message) |

**Premiered promotion path:**

```
Owner pays premiered plan
        │
POST /payments/verify → verified
        │
website.is_premiered = true
        │
Listing appears at top of all
browse / top / multi-category
queries regardless of sort_by
```

---

## 8. Payment & Subscription System

### Sequence Diagram

```
Owner          DirTera Backend            links.et
  │                   │                       │
  │── GET /payments/  │                       │
  │   plans ──────────►                       │
  │◄── plan prices ───│                       │
  │                   │                       │
  │  (user pays via   │                       │
  │   Telebirr app)   │                       │
  │                   │                       │
  │── POST /payments/ │                       │
  │   verify ─────────►                       │
  │  { website_id,    │                       │
  │    plan,          │── POST /api/verify ──►│
  │    receipt_url }  │   { url: receipt_url }│
  │                   │   x-api-key: ...      │
  │                   │◄── [ { ok, receipt } ]│
  │                   │                       │
  │                   │  validate amount      │
  │                   │  validate status      │
  │                   │  create Subscription  │
  │                   │  (status=active)      │
  │◄── VerifyPayment  │                       │
  │    Response ───────│                       │
```

### Amount Validation Logic

```python
expected = PLAN_PRICES[plan]           # e.g. 500.0 for "basic"
settled  = parse_birr("100 Birr")      # parsed from receipt

if abs(settled - expected) > 1.0:      # 1 ETB tolerance
    raise 400 "Amount mismatch"
```

### Double-Spend Protection

`subscriptions.receipt_url` has a `UNIQUE` constraint. If the same URL is submitted twice, the second request gets `409 Conflict` before even calling links.et.

### Plan Configuration

Plans and prices are defined as constants in `app/services/payment_service.py`:

```python
PLAN_PRICES = {
    SubscriptionPlan.BASIC:     500.0,
    SubscriptionPlan.STANDARD:  1200.0,
    SubscriptionPlan.PREMIUM:   2500.0,
    SubscriptionPlan.PREMIERED: 5000.0,
}

PLAN_DURATIONS = {        # days
    SubscriptionPlan.BASIC:     30,
    SubscriptionPlan.STANDARD:  90,
    SubscriptionPlan.PREMIUM:   180,
    SubscriptionPlan.PREMIERED: 30,
}
```

### Dev / Mock Mode

When `LINKSSET_API_KEY` is empty (default in `.env.dev`), `payment_service` skips the real links.et call and returns a mock successful response. The mock amount defaults to the BASIC plan price, or can be set via `?amount=1200` in the receipt URL for testing other plans.

---

## 9. Analytics System

### Data Flow

```
Visitor clicks listing
        │
GET /websites/{id}/click
        │
analytics_service.record_click()
   ├── Creates ClickEvent row
   │     ip_hash:    SHA-256(client IP)   ← anonymised, not raw IP
   │     user_agent: truncated to 512 chars
   │     referrer:   truncated to 2048 chars
   └── Increments website.total_clicks   ← denormalised counter

Client calls dashboard:
GET /analytics/{id}/stats    → daily time-series (default last 30 days)
GET /analytics/{id}/summary  → totals + top referrers + clicks by country
GET /analytics/{id}/export   → CSV download of all click events
```

### Time-Series Query

```sql
SELECT DATE(clicked_at) AS day, COUNT(id) AS cnt
FROM   click_events
WHERE  website_id = :id
  AND  clicked_at BETWEEN :start AND :end
GROUP  BY DATE(clicked_at)
ORDER  BY DATE(clicked_at)
```

Gaps (days with zero clicks) are filled in Python before returning the response, so the frontend always gets a complete date series.

### Privacy

| Field | Treatment |
|-------|-----------|
| IP address | SHA-256 hashed before storage — original IP never persisted |
| User agent | Stored as-is (browser/OS info only, no PII) |
| Referrer URL | Stored as-is |
| Authenticated user | Not linked to click events — analytics are anonymous |

---

## 10. Notification System

Notifications are in-app messages surfaced to listing owners. Currently triggered by the approval workflow; designed to be extended for subscription expiry reminders, review alerts, etc.

### Current triggers

| Trigger | Title | Body |
|---------|-------|------|
| Admin approves listing | "Your listing was approved!" | Listing name + confirmation |
| Admin rejects listing | "Your listing was not approved" | Listing name + rejection message |

### Schema

```
notifications
  user_id    → FK → users.id
  website_id → FK → websites.id (nullable, SET NULL on delete)
  title      VARCHAR(255)
  body       TEXT
  is_read    BOOLEAN  default false
```

### Read state management

- `PATCH /notifications/read-all` — bulk marks all unread as read
- `PATCH /notifications/{id}/read` — marks a single notification
- `GET /notifications?unread_only=true` — returns only unread count for badge display

---

## 11. Configuration & Database Portability

All configuration is read from environment variables via `pydantic-settings`. The single most important variable is `DATABASE_URL`.

### Switching databases

| Database | `DATABASE_URL` value |
|----------|----------------------|
| SQLite (dev) | `sqlite+aiosqlite:///./dirterra.db` |
| PostgreSQL | `postgresql+asyncpg://user:pass@host:5432/db` |
| Supabase | `postgresql+asyncpg://postgres:[pass]@db.[ref].supabase.co:5432/postgres` |

No code changes are needed — only the env var. Run `alembic upgrade head` after switching.

### Key environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT signing key — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Yes | SQLAlchemy async connection string |
| `GOOGLE_CLIENT_ID` | Yes (OAuth) | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes (OAuth) | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Yes (OAuth) | Must match Google Console setting |
| `LINKSSET_API_KEY` | Yes (prod) | From links.et dashboard — leave blank in dev for mock mode |
| `ALLOWED_ORIGINS` | Yes | Comma-separated frontend URLs for CORS |

---

## 12. Alembic Migration Strategy

### Running migrations

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Check current revision
alembic current

# Generate a new migration (after model changes)
alembic revision --autogenerate -m "add_xyz_column"

# Roll back one step
alembic downgrade -1
```

### Async support

`alembic/env.py` uses `async_engine_from_config` and `run_sync` to bridge the sync Alembic API with the async SQLAlchemy engine. This works transparently across all supported drivers (aiosqlite, asyncpg).

### Migration naming convention

```
0001_initial_schema.py          ← all tables created
0002_seed_categories_domains.py ← default taxonomy data
0003_add_xyz.py                 ← future incremental changes
```

### Seed migration idempotency

The seed migration uses `INSERT ... ON CONFLICT (slug) DO NOTHING` so it can be re-run safely against an existing database without duplicating rows.

---

## 13. ID Strategy — ULID

All primary keys use **ULID** (Universally Unique Lexicographically Sortable Identifier), stored as `CHAR(26)`.

**Why not auto-increment integers?**

| Problem | ULID solution |
|---------|---------------|
| Enumerate all resources by guessing IDs | 80 random bits — no predictable sequence |
| Leaks row count | Not encodable from ULID |
| Shard / merge conflicts | Globally unique by construction |

**Why not UUID4?**

| Property | UUID4 | ULID |
|----------|-------|------|
| Sortable | No | Yes — first 48 bits are millisecond timestamp |
| Index locality | Poor | Good — new rows cluster near each other |
| URL-safe | No (hyphens) | Yes |
| Length | 36 chars | 26 chars |

**Implementation:**

```python
# app/models/base.py
from ulid import ULID

class ULIDPrimaryKey:
    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=lambda: str(ULID()),
    )
```

ULID generation happens in Python at insert time, not in the database. This means the application always knows the ID before the row is committed, which simplifies logging and response building.

---

## 14. Scalability Considerations

### Current design (single server)

The current implementation is designed for a single application server + one database. This is appropriate for the initial launch phase.

### Horizontal scaling path

| Concern | Current | Scale-up path |
|---------|---------|---------------|
| DB connections | Single async pool | PgBouncer in front of Postgres |
| Session state | Stateless JWT | Already stateless — no change needed |
| Click events | Synchronous DB insert | Buffer in Redis, flush in batches |
| File uploads | Local `uploads/` dir | Move to S3-compatible object storage (MinIO, Supabase Storage) |
| Search | SQL `ILIKE` | Add PostgreSQL `tsvector` full-text index or Meilisearch |
| Caching | None | Redis cache for `GET /categories`, `GET /domains`, `GET /websites/top` |

### PostgreSQL-specific upgrades (when ready)

| Feature | How |
|---------|-----|
| Full-text search on name/description/tags | `tsvector` column + `GIN` index + `to_tsquery` |
| Tag filtering without ILIKE | `tags` column → `TEXT[]` array + `GIN` index + `@>` operator |
| ULID as native UUID | Cast `CHAR(26)` to `UUID` type for native Postgres UUID ops |
| Partitioned click_events | Partition `click_events` by `clicked_at` month for fast range queries at scale |

---

## 15. Dependency Map

```
app/main.py
 └── app/api/v1/router.py
      ├── auth.py          → auth_service  → security, models/user
      ├── users.py         → user_service  → models/user
      ├── categories.py    → category_service → models/category
      ├── websites.py      → website_service  → models/website
      │                       category_service (slug validation)
      │                       notification_service
      │                    → analytics_service → models/click
      ├── analytics.py     → analytics_service → models/click, website
      ├── payments.py      → payment_service → models/subscription, website
      │                       httpx (links.et API calls)
      ├── notifications.py → notification_service → models/notification
      ├── reviews.py       → models/review (inline)
      └── admin.py         → models/user, website, category, subscription

All routers depend on:
  app/core/deps.py   → get_current_user / require_admin / get_db
  app/core/database.py → AsyncSession
  app/core/config.py  → Settings
```

### External dependencies

| Service | Used by | Purpose |
|---------|---------|---------|
| Google OAuth 2.0 | `auth_service` | User login / registration |
| links.et `/api/verify` | `payment_service` | Parse + verify payment receipts |
| links.et `/api/status` | `payment_service` | Health check proxy |

Both external calls are made with `httpx.AsyncClient` inside service functions with explicit timeouts (30s for verify, 15s for health). Network errors are caught and re-raised as `503 Service Unavailable`.
