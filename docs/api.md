# DirTera API Contract

**Base URL:** `http://localhost:8000/api/v1`  
**Interactive docs:** `http://localhost:8000/docs` (Swagger UI) · `http://localhost:8000/redoc`  
**Version:** 0.1.0

---

## Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Categories & Domains](#3-categories--domains)
4. [Websites](#4-websites)
5. [Analytics](#5-analytics)
6. [Payments & Subscriptions](#6-payments--subscriptions)
7. [Notifications](#7-notifications)
8. [Reviews](#8-reviews)
9. [Admin](#9-admin)
10. [Legal](#10-legal)
11. [Common Conventions](#11-common-conventions)
12. [Error Responses](#12-error-responses)

---

## 1. Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Authentication is **Google OAuth 2.0 only**. Email/password registration and login have been removed.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/google` | — | Returns the Google OAuth redirect URL |
| `GET` | `/auth/google/callback` | — | Browser redirect handler — exchanges code, redirects to frontend with tokens in query string |
| `POST` | `/auth/google/callback` | — | SPA handler — POST the OAuth code, receive JWT tokens |
| `POST` | `/auth/refresh` | — | Exchange a refresh token for a new access token |
| `GET` | `/auth/me` | ✓ | Current user profile |

---

### `GET /auth/google`

**Response `200`**
```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

---

### `GET /auth/google/callback`

Used as the `redirect_uri` registered in the Google Cloud Console for browser-based OAuth flows. After verifying the code, the backend redirects the browser to:

```
{FRONTEND_ORIGIN}/auth/callback?access_token=eyJ...&refresh_token=eyJ...
```

The frontend reads the tokens from the query string and stores them.

---

### `POST /auth/google/callback`

SPA / mobile flow — POST the code from Google directly to the API.

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

### `POST /auth/refresh`

**Request body**
```json
{ "refresh_token": "eyJ..." }
```

**Response `200`** — same `TokenResponse` shape above.

---

### `GET /auth/me`

**Response `200`** — `UserOut` (see [Users](#2-users))

---

## 2. Users

### Schema — `UserOut`

```json
{
  "id": "01HZ8QP3N7GMKR5VXYWB4C0JDE",
  "email": "user@example.com",
  "full_name": "Abebe Kebede",
  "avatar_url": "https://lh3.googleusercontent.com/...",
  "is_admin": false,
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

**`UserOutAdmin`** — extends `UserOut` with `google_id` and `updated_at`.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users/me` | ✓ | Get own profile |
| `PATCH` | `/users/me` | ✓ | Update own profile |
| `GET` | `/users` | Admin | List all users (paginated) |
| `GET` | `/users/{user_id}` | Admin | Get user by ULID |
| `PATCH` | `/users/{user_id}/admin` | Admin | Toggle admin / active / verified |
| `DELETE` | `/users/{user_id}` | Admin | Deactivate user (sets `is_active=false`) |

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
| `search` | string | Matches `email` or `full_name` |
| `is_admin` | bool | Filter by admin flag |

**Response** — `PaginatedResponse<UserOutAdmin>`

---

### `PATCH /users/{user_id}/admin`

**Request body** (all optional)
```json
{ "is_admin": true, "is_active": true, "is_verified": true }
```

---

## 3. Categories & Domains

Categories are broad top-level buckets (e.g. `technology`, `health`). Domains are industry niches nested inside a category (e.g. `car_rental`, `clinic`). Both are **admin-managed at runtime** — no code or migration required to add new values.

---

### 3a. Categories

#### Schema — `CategoryOut`
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

#### `CategoryWithDomainsOut`
Same as `CategoryOut` plus a `domains: CategoryOut[]` array — used for the nav mega-menu.

#### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/categories/with-domains` | — | All active categories with their domains embedded |
| `GET` | `/categories` | — | List categories |
| `GET` | `/categories/{slug}` | — | Get one category |
| `POST` | `/categories` | Admin | Create category |
| `PATCH` | `/categories/{slug}` | Admin | Update category |
| `DELETE` | `/categories/{slug}` | Admin | Soft-deactivate (or hard delete) |

#### `GET /categories/with-domains`

Returns the full taxonomy tree in one request — intended for populating the frontend navigation mega-menu on app startup.

**Response** — `CategoryWithDomainsOut[]`

#### `GET /categories` — Query params

| Param | Default | Description |
|-------|---------|-------------|
| `active_only` | `true` | Return only active categories |

#### `POST /categories`

**Request body**
```json
{
  "slug": "automotive",
  "name": "Automotive",
  "description": "Cars, motorcycles, and vehicles",
  "icon": "🚗",
  "is_active": true,
  "sort_order": 5
}
```

> `slug` rules: lowercase letters, digits, and underscores only (e.g. `real_estate`).

#### `PATCH /categories/{slug}`

**Request body** (all optional)
```json
{ "name": "Automotive & Vehicles", "sort_order": 3, "is_active": true }
```

#### `DELETE /categories/{slug}`

| Query param | Default | Effect |
|-------------|---------|--------|
| `hard=false` | default | Sets `is_active=false`. Existing website slug references are preserved. |
| `hard=true` | — | Hard-deletes the row from the DB. |

---

### 3b. Domains

#### Schema — `DomainOut`
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

#### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/domains` | — | List domains |
| `GET` | `/domains/{slug}` | — | Get one domain |
| `POST` | `/domains` | Admin | Create domain |
| `PATCH` | `/domains/{slug}` | Admin | Update domain |
| `DELETE` | `/domains/{slug}` | Admin | Soft-deactivate or hard delete |

#### `GET /domains` — Query params

| Param | Default | Description |
|-------|---------|-------------|
| `active_only` | `true` | Return only active domains |
| `category_slug` | — | Filter domains belonging to a parent category |

#### `POST /domains`

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

## 4. Websites

### Schemas

**`WebsitePublicOut`** — safe public listing (no owner PII, URL hidden)
```json
{
  "id": "01HZ...",
  "name": "Ethio Rides",
  "short_description": "Ethiopia's #1 car rental platform",
  "logo_url": "https://...",
  "category_slug": "ecommerce",
  "domain_slug": "car_rental",
  "tags": "addis,car,rental,ethiopia",
  "is_verified": true,
  "is_premiered": false,
  "total_clicks": 1420,
  "avg_rating": 4.3,
  "review_count": 27,
  "created_at": "2026-01-01T00:00:00Z"
}
```

**`WebsitePublicDetailOut`** — adds `full_description`, `image_urls[]`, `owner_display_name`, `owner_avatar_url`. Still no raw URL (click-redirect only).

**`WebsiteOut`** — owner's own view, includes `url`, `status`, `rejection_message`, etc.

**`WebsiteDetailOut`** — admin / owner detail, adds full `owner` object.

**`WebsitePendingOut`** — admin queue view with owner info.

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
| `GET` | `/websites/{website_id}` | — | Full public listing detail |
| `GET` | `/websites/{website_id}/click` | — | Record click + redirect to listing URL |
| `POST` | `/websites` | ✓ | Register a new listing |
| `PATCH` | `/websites/{website_id}` | ✓ Owner | Update own listing |
| `DELETE` | `/websites/{website_id}` | ✓ Owner | Delete own listing + Supabase Storage images |
| `POST` | `/websites/{website_id}/images/logo` | ✓ Owner | Upload or replace listing logo |
| `DELETE` | `/websites/{website_id}/images/logo` | ✓ Owner | Delete listing logo |
| `POST` | `/websites/{website_id}/images` | ✓ Owner | Upload a gallery image (max 3) |
| `DELETE` | `/websites/{website_id}/images/{index}` | ✓ Owner | Delete a gallery image by index (0–2) |
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
| `category` | string | Category slug |
| `domain` | string | Domain slug |
| `keywords` | string | Comma-separated terms — matched against name, descriptions, tags, slugs |
| `sort_by` | string | `score` \| `rating` \| `clicks` \| `newest` (default: `score`) |

**Sort strategies**

| Value | Order |
|-------|-------|
| `score` | premiered first → avg_rating → total_clicks → newest |
| `rating` | avg_rating → total_clicks → newest |
| `clicks` | total_clicks → avg_rating → newest |
| `newest` | created_at DESC |

**Response** — `PaginatedResponse<WebsitePublicOut>`

---

### `GET /websites/top`

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | 10 | 1–50 |
| `category` | — | Category slug |
| `domain` | — | Domain slug |
| `keywords` | — | Comma-separated keywords |
| `sort_by` | `score` | Sort strategy |

**Response**
```json
{
  "limit": 10,
  "sort_by": "score",
  "total_found": 84,
  "items": [ ...WebsitePublicOut... ]
}
```

---

### `GET /websites/multi-category`

| Param | Description |
|-------|-------------|
| `categories` | Repeat this param for each slug (max 10) |
| `per_category` | Items per block, 1–20 (default: 5) |
| `domain` | Narrow every block to a domain |
| `keywords` | Apply keyword filter to every block |
| `sort_by` | Sort strategy |

**Response**
```json
{
  "per_category": 5,
  "blocks": [
    { "category_slug": "technology", "items": [ ...WebsitePublicOut... ] },
    { "category_slug": "health",     "items": [ ...WebsitePublicOut... ] }
  ]
}
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
  "category_slug": "ecommerce",
  "domain_slug": "car_rental",
  "tags": "addis,car,rental,ethiopia",
  "contact_email": "info@ethiorides.et",
  "phone_number": "+251911000000",
  "social_links": "{\"twitter\": \"@ethiorides\"}"
}
```

Status starts as `pending`. Listing goes live only after admin approval.

**Response `201`** — `WebsiteDetailOut`

---

### Image Uploads

Images are stored in Supabase Storage. Upload endpoints accept `multipart/form-data`.

| Slot | Max size | Allowed types |
|------|----------|---------------|
| Logo | 2 MB | JPEG, PNG, WEBP |
| Gallery (0–2) | 5 MB | JPEG, PNG, WEBP |

Images are resized/compressed to max 1920px and converted to WEBP before storage. Maximum 3 gallery images per listing — uploading a 4th returns `422`.

---

### `POST /websites/{website_id}/reject`

**Request body**
```json
{ "rejection_message": "Please provide a working contact email." }
```

The owner receives an in-app notification containing this message.

---

### `PATCH /websites/{website_id}/admin`

**Request body** (all optional)
```json
{ "is_premiered": true, "is_verified": true, "is_active": true }
```

---

### `GET /websites/admin/all` — Query params

| Param | Description |
|-------|-------------|
| `status` | `pending` \| `approved` \| `rejected` \| `suspended` |
| `search` | Matches name or URL |
| `category` | Category slug |
| `domain` | Domain slug |
| `page`, `page_size` | Pagination |

---

## 5. Analytics

Owner-protected. Admins can access stats for any listing.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/{website_id}/stats` | ✓ Owner/Admin | Daily click time-series |
| `GET` | `/analytics/{website_id}/summary` | ✓ Owner/Admin | Aggregated totals + referrers + countries |
| `GET` | `/analytics/{website_id}/export` | ✓ Owner/Admin | Download CSV of all click events |

---

### `GET /analytics/{website_id}/stats` — Query params

| Param | Description |
|-------|-------------|
| `start_date` | `YYYY-MM-DD`. Defaults to the listing's creation date (all-time). |
| `end_date` | `YYYY-MM-DD`. Defaults to today. |

Both params are respected when provided. `start_date` must not precede the listing's creation date.

**Response**
```json
{
  "website_id": "01HZ...",
  "website_name": "Ethio Rides",
  "total_clicks": 310,
  "data": [
    { "date": "2026-01-01", "clicks": 12 },
    { "date": "2026-01-02", "clicks": 0 }
  ]
}
```

Days with zero clicks are included so the frontend always gets a complete contiguous series.

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

Columns: `id`, `clicked_at`, `referrer`, `country_code`

---

## 6. Payments & Subscriptions

Receipt-based payment verification via [links.et](https://links.et). Plans and their prices are **admin-managed at runtime** through the plan CRUD endpoints.

### Payment flow

```
1. GET  /payments/plans              → browse available plans and prices
2. GET  /payments/subscribe/info     → confirm expected amount for a website + plan
3. User pays via Telebirr / CBE in their payment app
4. User copies their receipt URL
5. POST /payments/verify             → submit receipt URL → subscription activated
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/payments/plans` | — | List active plans (public) |
| `GET` | `/payments/plans/all` | Admin | List all plans including inactive |
| `POST` | `/payments/plans` | Admin | Create a plan |
| `PATCH` | `/payments/plans/{plan_id}` | Admin | Update a plan |
| `DELETE` | `/payments/plans/{plan_id}` | Admin | Soft-deactivate (or hard delete with `?hard=true`) |
| `GET` | `/payments/subscribe/info` | ✓ | Cost preview for a plan + website |
| `POST` | `/payments/verify` | ✓ | Verify receipt URL → activate subscription |
| `GET` | `/payments/subscriptions` | ✓ | List own subscriptions |
| `GET` | `/payments/health` | — | links.et service health |

---

### `GET /payments/plans`

**Response** — `PlanConfigOut[]`

```json
[
  {
    "id": "01HZ...",
    "slug": "basic",
    "label": "Basic",
    "description": "30-day standard listing",
    "amount": 500.0,
    "currency": "ETB",
    "duration_days": 30,
    "is_premiered": false,
    "is_active": true,
    "sort_order": 0,
    "receiver_name": "DirTera Account",
    "receiver_phone": "+251911000000",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
]
```

---

### `POST /payments/plans` (Admin)

**Request body**
```json
{
  "slug": "basic",
  "label": "Basic",
  "description": "30-day standard listing",
  "amount": 500.0,
  "currency": "ETB",
  "duration_days": 30,
  "is_premiered": false,
  "is_active": true,
  "sort_order": 0,
  "receiver_name": "DirTera Telebirr Account",
  "receiver_phone": "+251911000000"
}
```

> `receiver_name` and `receiver_phone` are **required** — they are used to validate the credited party on every receipt. A plan without them cannot process payments.

---

### `PATCH /payments/plans/{plan_id}` (Admin)

**Request body** (all optional)
```json
{ "amount": 600.0, "duration_days": 45, "is_active": false }
```

---

### `DELETE /payments/plans/{plan_id}` (Admin)

| Query param | Effect |
|-------------|--------|
| `hard=false` (default) | Soft-deactivates — sets `is_active=false`. Existing subscriptions using this plan slug are unaffected. |
| `hard=true` | Hard-deletes the row. |

---

### `GET /payments/subscribe/info` — Query params

| Param | Description |
|-------|-------------|
| `website_id` | ULID of the listing to subscribe |
| `plan` | Plan slug, e.g. `basic` |

**Response**
```json
{
  "website_id": "01HZ...",
  "website_name": "Ethio Rides",
  "plan": "basic",
  "label": "Basic",
  "amount": 500.0,
  "currency": "ETB",
  "duration_days": 30,
  "is_premiered": false
}
```

---

### `POST /payments/verify`

Rate-limited: 5 requests per minute per IP.

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
4. Validates `settledAmount` matches plan price (±1 ETB tolerance)
5. Validates `transactionStatus == "Completed"`
6. Validates `creditedPartyName` matches `plan.receiver_name`
7. Validates `creditedPartyAccountNo` suffix matches `plan.receiver_phone`
8. Creates `Subscription` row with `status=active`
9. Sets `website.is_premiered=true` if plan is a premiered plan

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
  "receipt": { "...raw receipt fields from links.et..." },
  "provider": "telebirr",
  "message": "Subscription activated. Your 'Basic' plan is valid for 30 days."
}
```

**Error cases**

| Status | Reason |
|--------|--------|
| `404` | Website not found |
| `403` | Not the owner |
| `400` | Website not yet approved |
| `409` | Receipt URL already used |
| `422` | links.et could not parse the receipt, or amount/status field missing |
| `400` | Amount mismatch (shows expected vs actual) |
| `400` | Transaction not completed |
| `400` | Receiver name or phone mismatch |
| `500` | Plan is not configured with receiver details |
| `503` | links.et unreachable |

---

### `GET /payments/subscriptions`

**Response** — `SubscriptionOut[]` (all subscriptions belonging to the current user, newest first)

---

### `GET /payments/health`

**Response**
```json
{
  "ok": true,
  "status": "operational",
  "checkedAt": "2026-01-01T00:00:00Z",
  "components": [
    { "name": "verify-web (this service)", "status": "operational", "responseMs": 0 },
    { "name": "Postgres (auth + API keys)", "status": "operational", "responseMs": 5 },
    { "name": "Telebirr — transactioninfo.ethiotelecom.et", "status": "operational", "responseMs": 649 }
  ]
}
```

---

## 7. Notifications

In-app messages sent to listing owners on approval or rejection.

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

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | — |
| `page_size` | 20 | Max: 100 |
| `unread_only` | `false` | Return only unread notifications |

**Response** — `PaginatedResponse<NotificationOut>`

---

## 8. Reviews

One review per user per website. Rating is 1–5; body text is optional.

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
| `POST` | `/reviews/{website_id}` | ✓ | Submit a review (one per user per website) |
| `GET` | `/reviews/{website_id}` | — | List visible reviews for a website |
| `PATCH` | `/reviews/{review_id}` | ✓ Author | Edit own review |
| `DELETE` | `/reviews/{review_id}` | ✓ Author | Delete own review |
| `DELETE` | `/reviews/{review_id}/admin` | Admin | Remove any review |
| `PATCH` | `/reviews/{review_id}/hide` | Admin | Toggle review visibility |

---

### `POST /reviews/{website_id}`

**Request body**
```json
{ "rating": 4, "body": "Great service!" }
```

> `rating`: integer 1–5. Submitting twice returns `409 Conflict`.

After any review write (create / update / delete / hide), `website.avg_rating` and `website.review_count` are recalculated immediately.

---

### `PATCH /reviews/{review_id}/hide`

| Query param | Description |
|-------------|-------------|
| `hide=true` | Hides the review from public listing |
| `hide=false` | Restores visibility |

---

## 9. Admin

All endpoints require `is_admin=true`.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/admin/dashboard` | Admin | Platform-wide aggregate stats |
| `GET` | `/admin/requests` | Admin | Pending approval queue (paginated) |
| `GET` | `/admin/subscriptions` | Admin | All subscriptions across all users (paginated) |

---

### `GET /admin/dashboard`

Stats are computed in **5 grouped queries** (users, websites, subscriptions, categories, domains + plans). Efficient even at scale.

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
  },
  "plans": { "total": 4, "active": 4 }
}
```

---

### `GET /admin/requests` — Query params

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | — |
| `page_size` | 20 | Max: 100 |

**Response** — `PaginatedResponse<WebsitePendingOut>` (pending listings only, oldest first)

---

### `GET /admin/subscriptions` — Query params

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | — |
| `page_size` | 20 | Max: 100 |
| `status` | — | Filter by status: `pending` \| `active` \| `expired` \| `cancelled` \| `failed` |

**Response** — `PaginatedResponse<AdminSubscriptionOut>`

```json
{
  "items": [
    {
      "user_id": "01HZ...",
      "website_id": "01HZ...",
      "plan": "basic",
      "amount": 500.0,
      "currency": "ETB",
      "status": "active",
      "starts_at": "2026-01-01T00:00:00Z",
      "expires_at": "2026-01-31T00:00:00Z"
    }
  ],
  "total": 186,
  "page": 1,
  "page_size": 20,
  "total_pages": 10
}
```

---

## 10. Legal

Static structured JSON — edit content in `app/api/v1/legal.py`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/legal/terms` | — | Terms of Service |
| `GET` | `/legal/privacy` | — | Privacy Policy |

Both return `{ title, effective_date, version, sections: [{ heading, body }] }`.

---

## 11. Common Conventions

### ULID IDs

All entity IDs are **ULID strings** (26 characters, e.g. `01HZ8QP3N7GMKR5VXYWB4C0JDE`). Time-sortable, URL-safe, no sequential enumeration risk.

### Paginated responses

```json
{
  "items": [...],
  "total": 340,
  "page": 1,
  "page_size": 20,
  "total_pages": 17
}
```

### Rate limiting

| Endpoint group | Default limit |
|----------------|---------------|
| Auth (`/auth/*`) | 10 req/min per IP |
| Payment verify (`/payments/verify`) | 5 req/min per IP |
| Click redirect (`/websites/*/click`) | 60 req/min per IP |
| Review submit (`/reviews/*`) | 10 req/min per IP |

Exceeding a limit returns `429 Too Many Requests` with a `Retry-After` header.

### Editing approved listings

Changing `name`, `url`, `short_description`, or `full_description` on an already-approved listing resets its status back to `pending` and re-queues it for admin review.

---

## 12. Error Responses

All errors follow this shape:

```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — business rule violation (amount mismatch, wrong status, etc.) |
| `401` | Missing or invalid access token |
| `403` | Authenticated but not authorised (wrong role or not the owner) |
| `404` | Resource not found |
| `409` | Conflict — duplicate URL, receipt, or review |
| `422` | Validation error — field format, unknown slug, or upstream parse failure |
| `429` | Rate limit exceeded |
| `500` | Server-side misconfiguration (e.g. plan missing receiver details) |
| `503` | External service unreachable (links.et) |
