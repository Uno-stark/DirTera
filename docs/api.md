# DirTera API Contract

**Base URL:** `http://localhost:8000/api/v1`  
**Interactive docs:** `http://localhost:8000/docs` (Swagger UI) · `http://localhost:8000/redoc`  
**Version:** 0.1.0  

---

## Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Categories](#3-categories)
4. [Domains](#4-domains)
5. [Websites](#5-websites)
6. [Analytics](#6-analytics)
7. [Payments](#7-payments)
8. [Notifications](#8-notifications)
9. [Reviews](#9-reviews)
10. [Admin Dashboard](#10-admin-dashboard)
11. [Common Conventions](#11-common-conventions)
12. [Error Responses](#12-error-responses)

---

## 1. Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/google` | — | Returns the Google OAuth redirect URL |
| `GET` | `/auth/google/callback` | — | Browser redirect handler; exchanges code → redirects to frontend with tokens |
| `POST` | `/auth/google/callback` | — | SPA handler; POST the OAuth code, receive JWT tokens |
| `POST` | `/auth/register` | — | Register with email + password |
| `POST` | `/auth/login` | — | Login with email + password |
| `POST` | `/auth/refresh` | — | Exchange refresh token for new access token |
| `GET` | `/auth/me` | ✓ | Current user profile |

---

### `GET /auth/google`

**Response `200`**
```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

---

### `POST /auth/google/callback`

**Request body**
```json
{ "code": "4/0AX4XfWi...", "state": null }
```

**Response `200`**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

---

### `POST /auth/register`

**Request body**
```json
{
  "email": "user@example.com",
  "full_name": "Abebe Kebede",
  "password": "StrongPass123!"
}
```

**Response `201`** — `UserOut` object (see [Users](#2-users))

---

### `POST /auth/login`

**Request body**
```json
{ "email": "user@example.com", "password": "StrongPass123!" }
```

**Response `200`** — `TokenResponse`

---

### `POST /auth/refresh`

**Request body**
```json
{ "refresh_token": "eyJ..." }
```

**Response `200`** — `TokenResponse`

---

## 2. Users

### Schemas

**`UserOut`**
```json
{
  "id": "01HZ8QP3N7GMKR5VXYWB4C0JDE",
  "email": "user@example.com",
  "full_name": "Abebe Kebede",
  "avatar_url": "https://...",
  "is_admin": false,
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

**`UserOutAdmin`** — extends `UserOut` with `google_id`, `updated_at`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users/me` | ✓ | Get own profile |
| `PATCH` | `/users/me` | ✓ | Update own profile |
| `GET` | `/users` | Admin | List all users (paginated) |
| `GET` | `/users/{user_id}` | Admin | Get user by ULID |
| `PATCH` | `/users/{user_id}/admin` | Admin | Toggle admin / active / verified |
| `DELETE` | `/users/{user_id}` | Admin | Deactivate user |

---

### `PATCH /users/me`

**Request body** (all fields optional)
```json
{ "full_name": "New Name", "avatar_url": "https://..." }
```

---

### `GET /users` — Query params

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Default: 1 |
| `page_size` | int | Default: 20, max: 100 |
| `search` | string | Matches email or full_name |
| `is_admin` | bool | Filter by admin flag |

**Response** — `PaginatedResponse<UserOutAdmin>`

---

### `PATCH /users/{user_id}/admin`

**Request body** (all optional)
```json
{ "is_admin": true, "is_active": true, "is_verified": true }
```

---

## 3. Categories

Categories are the broad top-level classification bucket (e.g. `technology`, `health`).  
They are **admin-managed at runtime** — no code change needed to add new ones.

### Schema — `CategoryOut`
```json
{
  "id": "01HZ...",
  "slug": "technology",
  "name": "Technology",
  "description": null,
  "icon": "💻",
  "is_active": true,
  "sort_order": 0,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/categories` | — | List categories |
| `GET` | `/categories/{slug}` | — | Get one category |
| `POST` | `/categories` | Admin | Create category |
| `PATCH` | `/categories/{slug}` | Admin | Update category |
| `DELETE` | `/categories/{slug}` | Admin | Soft-deactivate (or hard delete) |

---

### `GET /categories` — Query params

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active_only` | bool | `true` | Only return active categories |

---

### `POST /categories`

**Request body**
```json
{
  "slug": "automotive",
  "name": "Automotive",
  "description": "Cars, motorcycles, vehicles",
  "icon": "🚗",
  "is_active": true,
  "sort_order": 5
}
```

> `slug` rules: lowercase, digits, underscores only (e.g. `real_estate`)

---

### `PATCH /categories/{slug}`

**Request body** (all optional)
```json
{ "name": "Automotive & Vehicles", "sort_order": 3, "is_active": true }
```

---

### `DELETE /categories/{slug}`

| Query param | Default | Effect |
|-------------|---------|--------|
| `hard=false` | default | Sets `is_active=false`. Existing websites keep their slug reference. |
| `hard=true` | — | Hard-deletes the row from the DB. |

---

## 4. Domains

Domains are industry niches inside a category (e.g. `car_rental`, `clinic`, `law`).  
Also **admin-managed at runtime**.

### Schema — `DomainOut`
```json
{
  "id": "01HZ...",
  "slug": "car_rental",
  "name": "Car Rental",
  "description": null,
  "icon": "🚙",
  "is_active": true,
  "sort_order": 5,
  "category_slug": "ecommerce",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/domains` | — | List domains |
| `GET` | `/domains/{slug}` | — | Get one domain |
| `POST` | `/domains` | Admin | Create domain |
| `PATCH` | `/domains/{slug}` | Admin | Update domain |
| `DELETE` | `/domains/{slug}` | Admin | Soft-deactivate or hard delete |

---

### `GET /domains` — Query params

| Param | Type | Description |
|-------|------|-------------|
| `active_only` | bool | Default: `true` |
| `category_slug` | string | Filter domains under a parent category |

---

### `POST /domains`

**Request body**
```json
{
  "slug": "solar_energy",
  "name": "Solar Energy",
  "icon": "☀️",
  "is_active": true,
  "sort_order": 0,
  "category_slug": "technology"
}
```

---

## 5. Websites

### Schema — `WebsiteOut`
```json
{
  "id": "01HZ...",
  "owner_id": "01HZ...",
  "name": "Ethio Rides",
  "url": "https://ethiorides.et",
  "short_description": "Ethiopia's #1 car rental platform",
  "full_description": "...",
  "thumbnail_url": "https://...",
  "logo_url": "https://...",
  "category_slug": "ecommerce",
  "domain_slug": "car_rental",
  "tags": "addis,car,rental,ethiopia",
  "contact_email": "info@ethiorides.et",
  "phone_number": "+251911000000",
  "social_links": "{\"twitter\": \"@ethiorides\"}",
  "status": "approved",
  "is_active": true,
  "is_verified": true,
  "is_premiered": false,
  "total_clicks": 1420,
  "avg_rating": 4.3,
  "review_count": 27,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**`WebsiteDetailOut`** — extends `WebsiteOut` with `owner` (name, email, avatar) and `rejection_message`.

### Status values
| Value | Meaning |
|-------|---------|
| `pending` | Submitted, awaiting admin review |
| `approved` | Live and visible to the public |
| `rejected` | Not approved; `rejection_message` is set |
| `suspended` | Temporarily hidden by admin |

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/websites` | — | Browse approved listings |
| `GET` | `/websites/top` | — | Top N listings (site-wide or filtered) |
| `GET` | `/websites/multi-category` | — | Home-page feed — one block per category |
| `GET` | `/websites/premiered` | — | Premiered listings only |
| `GET` | `/websites/my` | ✓ | Current user's listings |
| `GET` | `/websites/{website_id}` | — | Full listing detail |
| `GET` | `/websites/{website_id}/click` | — | Record click + redirect to listing URL |
| `POST` | `/websites` | ✓ | Register a new listing |
| `PATCH` | `/websites/{website_id}` | ✓ Owner | Update own listing |
| `DELETE` | `/websites/{website_id}` | ✓ Owner | Delete own listing |
| `GET` | `/websites/admin/all` | Admin | All listings with full filters |
| `POST` | `/websites/{website_id}/approve` | Admin | Approve listing |
| `POST` | `/websites/{website_id}/reject` | Admin | Reject with message |
| `PATCH` | `/websites/{website_id}/admin` | Admin | Toggle premiered / verified / active |

---

### `GET /websites` — Query params

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Default: 1 |
| `page_size` | int | Default: 20, max: 100 |
| `category` | string | Category slug, e.g. `technology` |
| `domain` | string | Domain slug, e.g. `car_rental` |
| `keywords` | string | Comma-separated terms, e.g. `addis,saas,delivery` |
| `sort_by` | string | `score` \| `rating` \| `clicks` \| `newest` (default: `score`) |

**Sort strategies:**

| Value | Order |
|-------|-------|
| `score` | premiered first → avg_rating → total_clicks → newest |
| `rating` | avg_rating → total_clicks → newest |
| `clicks` | total_clicks → avg_rating → newest |
| `newest` | created_at DESC |

**Response** — `PaginatedResponse<WebsiteOut>`

---

### `GET /websites/top` — Query params

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 10 | 1–50 |
| `category` | string | — | Category slug |
| `domain` | string | — | Domain slug |
| `keywords` | string | — | Comma-separated keywords |
| `sort_by` | string | `score` | Sort strategy |

**Response**
```json
{
  "limit": 10,
  "sort_by": "score",
  "total_found": 84,
  "items": [ ...WebsiteOut... ]
}
```

**Examples:**
```
GET /websites/top?domain=car_rental&limit=5
GET /websites/top?category=health&sort_by=rating&limit=10
GET /websites/top?keywords=addis,startup&sort_by=clicks
GET /websites/top?limit=10                          # site-wide top 10
```

---

### `GET /websites/multi-category` — Query params

| Param | Type | Description |
|-------|------|-------------|
| `categories` | string[] | Category slugs — repeat param (max 10) |
| `per_category` | int | Items per section, 1–20 (default: 5) |
| `domain` | string | Narrow every section to a domain |
| `keywords` | string | Apply keyword filter to every section |
| `sort_by` | string | Sort strategy |

**Response**
```json
{
  "per_category": 5,
  "blocks": [
    {
      "category_slug": "technology",
      "items": [ ...5 WebsiteOut... ]
    },
    {
      "category_slug": "health",
      "items": [ ...5 WebsiteOut... ]
    }
  ]
}
```

**Example:**
```
GET /websites/multi-category?categories=technology&categories=health&categories=finance&per_category=5
```

---

### `POST /websites`

**Request body**
```json
{
  "name": "Ethio Rides",
  "url": "https://ethiorides.et",
  "short_description": "Ethiopia's #1 car rental platform",
  "full_description": "...",
  "thumbnail_url": "https://cdn.example.com/thumb.jpg",
  "logo_url": "https://cdn.example.com/logo.png",
  "category_slug": "ecommerce",
  "domain_slug": "car_rental",
  "tags": "addis,car,rental,ethiopia",
  "contact_email": "info@ethiorides.et",
  "phone_number": "+251911000000",
  "social_links": "{\"twitter\": \"@ethiorides\"}"
}
```

> After submission, status is `pending`. Listing goes live only after admin approval.

**Response `201`** — `WebsiteDetailOut`

---

### `POST /websites/{website_id}/reject`

**Request body**
```json
{ "rejection_message": "Please provide a working contact email and a clearer description." }
```

> The owner receives an in-app notification with this message.

---

### `PATCH /websites/{website_id}/admin`

**Request body** (all optional)
```json
{ "is_premiered": true, "is_verified": true, "is_active": true }
```

---

### `GET /websites/admin/all` — Query params

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `pending` \| `approved` \| `rejected` \| `suspended` |
| `search` | string | Matches name or URL |
| `category` | string | Category slug |
| `domain` | string | Domain slug |
| `page` | int | — |
| `page_size` | int | — |

---

## 6. Analytics

Client dashboard stats. All endpoints are owner-protected — you can only access stats for websites you own.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/{website_id}/stats` | ✓ Owner | Daily click time-series |
| `GET` | `/analytics/{website_id}/summary` | ✓ Owner | Aggregated totals + referrers + countries |
| `GET` | `/analytics/{website_id}/export` | ✓ Owner | Download CSV of all click events |

---

### `GET /analytics/{website_id}/stats` — Query params

| Param | Type | Description |
|-------|------|-------------|
| `start_date` | date | `YYYY-MM-DD` (default: 30 days ago) |
| `end_date` | date | `YYYY-MM-DD` (default: today) |

**Response**
```json
{
  "website_id": "01HZ...",
  "website_name": "Ethio Rides",
  "total_clicks": 310,
  "data": [
    { "date": "2026-01-01", "clicks": 12 },
    { "date": "2026-01-02", "clicks": 8 }
  ]
}
```

---

### `GET /analytics/{website_id}/summary`

**Response**
```json
{
  "total_clicks": 1420,
  "clicks_today": 23,
  "clicks_last_7_days": 189,
  "clicks_last_30_days": 740,
  "top_referrers": [
    { "referrer": "https://google.com", "count": 340 }
  ],
  "clicks_by_country": [
    { "country": "ET", "count": 1100 }
  ]
}
```

---

### `GET /analytics/{website_id}/export`

**Response** — `text/csv` file download

```
Content-Disposition: attachment; filename=clicks_01HZ....csv
```

CSV columns: `id`, `clicked_at`, `referrer`, `country_code`

---

## 7. Payments

Receipt-based payment verification via [links.et](https://links.et).

### Flow

```
1. Call GET /payments/plans            → see prices
2. Call GET /payments/subscribe/info   → confirm expected amount
3. User pays via Telebirr / CBE / etc.
4. User gets receipt URL from their payment app
5. Call POST /payments/verify          → submit URL, activate subscription
```

### Subscription plans

| Plan | Price (ETB) | Duration | Effect |
|------|-------------|----------|--------|
| `basic` | 500 | 30 days | Standard listing |
| `standard` | 1,200 | 90 days | Standard listing |
| `premium` | 2,500 | 180 days | Standard listing |
| `premiered` | 5,000 | 30 days | Listed in premiered section |

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/payments/plans` | — | List all plan prices |
| `GET` | `/payments/subscribe/info` | ✓ | Cost preview for a plan + website |
| `POST` | `/payments/verify` | ✓ | Verify receipt URL → activate subscription |
| `GET` | `/payments/subscriptions` | ✓ | List own subscriptions |
| `GET` | `/payments/health` | — | links.et service health |

---

### `GET /payments/subscribe/info` — Query params

| Param | Type | Description |
|-------|------|-------------|
| `website_id` | string | ULID |
| `plan` | string | `basic` \| `standard` \| `premium` \| `premiered` |

**Response**
```json
{
  "website_id": "01HZ...",
  "website_name": "Ethio Rides",
  "plan": "basic",
  "amount": 500.0,
  "currency": "ETB",
  "duration_days": 30
}
```

---

### `POST /payments/verify`

**Request body**
```json
{
  "website_id": "01HZ...",
  "plan": "basic",
  "receipt_url": "https://transactioninfo.ethiotelecom.et/receipt/ABCD1234EF"
}
```

**What happens internally:**
1. Validates website ownership and approval status
2. Checks receipt URL hasn't been used before (prevents double-spending)
3. Calls `POST https://links.et/api/verify` with `x-api-key` header
4. Validates `settledAmount` matches the plan price (±1 ETB tolerance)
5. Validates `transactionStatus == "Completed"` (Telebirr)
6. Activates subscription; sets `is_premiered=true` for the `premiered` plan

**Response `200`**
```json
{
  "subscription": {
    "id": "01HZ...",
    "website_id": "01HZ...",
    "plan": "basic",
    "status": "active",
    "amount": 500.0,
    "currency": "ETB",
    "receipt_url": "https://transactioninfo.ethiotelecom.et/receipt/ABCD1234EF",
    "payment_provider": "telebirr",
    "receipt_no": "ABCD1234EF",
    "starts_at": "2026-01-01T00:00:00Z",
    "expires_at": "2026-01-31T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z"
  },
  "receipt": { ...raw receipt fields from links.et... },
  "provider": "telebirr",
  "message": "Subscription activated. Your basic plan is valid for 30 days."
}
```

**Error cases:**

| Status | Reason |
|--------|--------|
| `404` | Website not found |
| `403` | Not the owner |
| `400` | Website not yet approved |
| `409` | Receipt URL already used |
| `422` | links.et could not parse receipt, or amount missing |
| `400` | Amount mismatch (shows expected vs actual) |
| `400` | Transaction not completed |
| `503` | links.et unreachable |

---

### `GET /payments/health`

**Response**
```json
{
  "ok": true,
  "status": "operational",
  "checkedAt": "2026-01-01T00:00:00Z",
  "components": [
    { "name": "verify-web (this service)", "host": "links.et", "group": "internal", "status": "operational", "responseMs": 0, "httpStatus": 200, "error": null },
    { "name": "Postgres (auth + API keys)", "host": "127.0.0.1:5432", "group": "internal", "status": "operational", "responseMs": 5, "httpStatus": null, "error": null },
    { "name": "Telebirr — transactioninfo.ethiotelecom.et", "host": "transactioninfo.ethiotelecom.et", "group": "upstream", "status": "operational", "responseMs": 649, "httpStatus": 200, "error": null }
  ]
}
```

---

## 8. Notifications

In-app notifications sent to listing owners on approval or rejection.

### Schema — `NotificationOut`
```json
{
  "id": "01HZ...",
  "title": "Your listing was approved!",
  "body": "\"Ethio Rides\" has been approved and is now live on DirTera.",
  "is_read": false,
  "website_id": "01HZ...",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/notifications` | ✓ | List own notifications (paginated) |
| `PATCH` | `/notifications/read-all` | ✓ | Mark all as read |
| `PATCH` | `/notifications/{notification_id}/read` | ✓ | Mark one as read |

---

### `GET /notifications` — Query params

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | — |
| `page_size` | int | 20 | max: 100 |
| `unread_only` | bool | `false` | Return only unread |

**Response** — `PaginatedResponse<NotificationOut>`

---

## 9. Reviews

Logged-in users can leave one rating (1–5) and optional text review per website.

### Schema — `ReviewOut`
```json
{
  "id": "01HZ...",
  "author_id": "01HZ...",
  "website_id": "01HZ...",
  "rating": 4,
  "body": "Great platform, very responsive support.",
  "is_visible": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/reviews/{website_id}` | ✓ | Submit a review |
| `GET` | `/reviews/{website_id}` | — | List visible reviews for a website |
| `PATCH` | `/reviews/{review_id}` | ✓ Author | Edit own review |
| `DELETE` | `/reviews/{review_id}` | ✓ Author | Delete own review |
| `DELETE` | `/reviews/{review_id}/admin` | Admin | Remove any review |
| `PATCH` | `/reviews/{review_id}/hide` | Admin | Toggle visibility |

---

### `POST /reviews/{website_id}`

**Request body**
```json
{ "rating": 4, "body": "Great service!" }
```

> `rating` must be 1–5. One review per user per website; submitting again returns `409`.

---

### `GET /reviews/{website_id}` — Query params

| Param | Default |
|-------|---------|
| `page` | 1 |
| `page_size` | 20 |

**Response** — `PaginatedResponse<ReviewOut>`

---

### `PATCH /reviews/{review_id}/hide`

| Query param | Description |
|-------------|-------------|
| `hide=true` | Hides the review from public view |
| `hide=false` | Restores visibility |

---

## 10. Admin Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/dashboard` | Admin | Platform-wide aggregate stats |
| `GET` | `/admin/requests` | Admin | Pending approval queue (paginated) |

---

### `GET /admin/dashboard`

**Response**
```json
{
  "users": { "total": 1240, "active": 1190 },
  "websites": {
    "total": 340,
    "pending": 12,
    "approved": 298,
    "rejected": 22,
    "premiered": 8
  },
  "subscriptions": { "active": 186 },
  "taxonomy": {
    "categories": { "total": 14, "active": 14 },
    "domains":    { "total": 51, "active": 51 }
  }
}
```

---

## 11. Common Conventions

### ULID IDs

All entity IDs are **ULID strings** (26 characters, e.g. `01HZ8QP3N7GMKR5VXYWB4C0JDE`).  
Time-sortable, URL-safe, no enumeration risk.

### Paginated responses

All list endpoints return:

```json
{
  "items": [...],
  "total": 340,
  "page": 1,
  "page_size": 20,
  "total_pages": 17
}
```

### Category / Domain slugs

Slugs are lowercase with underscores only (e.g. `real_estate`, `car_rental`).  
Call `GET /categories` or `GET /domains` to list all valid values before submitting a listing.

### Editing approved listings

Changing `name`, `url`, `short_description`, or `full_description` on an approved listing resets its status to `pending` and re-queues it for admin review.

---

## 12. Error Responses

All errors follow this shape:

```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — invalid input or business rule violation |
| `401` | Missing or invalid token |
| `403` | Authenticated but not authorised (wrong role or not the owner) |
| `404` | Resource not found |
| `409` | Conflict — duplicate URL, email, or receipt |
| `422` | Validation error — field format or slug does not exist |
| `502` | Upstream API error (links.et) |
| `503` | External service unreachable |
