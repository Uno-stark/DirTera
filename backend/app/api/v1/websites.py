import math
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import RedirectResponse
from fastapi_cache.decorator import cache
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import AdminUser, CurrentUser, DBSession
from app.core.limiter import limiter
from app.models.website import WebsiteStatus
from app.schemas.common import PaginatedResponse
from app.schemas.website import (
    ImageUploadResponse,
    MultiCategoryResponse,
    RejectWebsite,
    TopNResponse,
    WebsiteAdminUpdate,
    WebsiteCreate,
    WebsiteDetailOut,
    WebsiteOut,
    WebsitePendingOut,
    WebsitePublicDetailOut,
    WebsitePublicOut,
    WebsiteUpdate,
    _split_image_urls,
)
from app.services import analytics_service, image_service, website_service

router = APIRouter(prefix="/websites", tags=["Websites"])
_SORT_OPTIONS = ["score", "rating", "clicks", "newest"]

# Cache TTL
_CACHE_TTL = settings.CACHE_TTL_SECONDS


# ── Public 

@router.get("", response_model=PaginatedResponse[WebsitePublicOut], summary="Browse listings")
@cache(expire=_CACHE_TTL)
async def browse_websites(
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    keywords: Optional[str] = Query(None),
    sort_by: str = Query("score"),
):
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    items, total = await website_service.list_websites_public(
        db, page, page_size, category, domain, keywords, sort_by=sort_by
    )
    return PaginatedResponse(
        items=[WebsitePublicOut.model_validate(i) for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/top", response_model=TopNResponse, summary="Top N listings")
@cache(expire=_CACHE_TTL)
async def top_websites(
    db: DBSession,
    limit: int = Query(10, ge=1, le=50),
    category: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    keywords: Optional[str] = Query(None),
    sort_by: str = Query("score"),
):
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    return await website_service.get_top_n(db, limit, category, domain, keywords, sort_by)


@router.get("/multi-category", response_model=MultiCategoryResponse, summary="Multi-category feed")
@cache(expire=_CACHE_TTL)
async def multi_category(
    db: DBSession,
    categories: List[str] = Query(...),
    per_category: int = Query(5, ge=1, le=20),
    domain: Optional[str] = Query(None),
    keywords: Optional[str] = Query(None),
    sort_by: str = Query("score"),
):
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    return await website_service.get_multi_category(
        db, categories, per_category, sort_by, domain, keywords
    )


@router.get("/premiered", response_model=PaginatedResponse[WebsitePublicOut], summary="Premiered listings")
@cache(expire=_CACHE_TTL)
async def premiered_websites(
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("score"),
):
    if sort_by not in _SORT_OPTIONS:
        sort_by = "score"
    items, total = await website_service.list_websites_public(
        db, page, page_size, is_premiered=True, sort_by=sort_by
    )
    return PaginatedResponse(
        items=[WebsitePublicOut.model_validate(i) for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/my", response_model=PaginatedResponse[WebsiteOut], summary="My listings")
async def my_websites(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    items, total = await website_service.list_my_websites(current_user.id, db, page, page_size)
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/admin/all", response_model=PaginatedResponse[WebsitePendingOut], summary="Admin: all listings")
async def admin_list_websites(
    _admin: AdminUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[WebsiteStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
):
    items, total = await website_service.list_websites_admin(
        db, page, page_size, status_filter, search, category, domain
    )
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/{website_id}", response_model=WebsitePublicDetailOut, summary="Listing detail (public)")
@cache(expire=_CACHE_TTL)
async def get_website_public(website_id: str, db: DBSession):
    website = await website_service.get_website_by_id(website_id, db)
    return website_service.to_public_detail(website)


@router.get("/{website_id}/click", summary="Record click → redirect")
@limiter.limit(settings.RATE_LIMIT_CLICK)
async def click_redirect(
    request: Request,
    response: Response,
    website_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Rate-limited — prevents click farming. Destination URL only in redirect."""
    website = await website_service.get_website_by_id(website_id, db)
    await analytics_service.record_click(website, request, db)
    return RedirectResponse(url=website.url, status_code=302)


# ── Client (owner) ─────────────────────────────────────────────────────────────

@router.post("", response_model=WebsiteDetailOut, status_code=201)
async def register_website(payload: WebsiteCreate, current_user: CurrentUser, db: DBSession):
    website = await website_service.create_website(payload, current_user, db)
    return await website_service.get_website_by_id(website.id, db)


@router.patch("/{website_id}", response_model=WebsiteDetailOut)
async def update_website(
    website_id: str, payload: WebsiteUpdate, current_user: CurrentUser, db: DBSession
):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)
    updated = await website_service.update_website(website, payload, db)
    return await website_service.get_website_by_id(updated.id, db)


@router.delete("/{website_id}", status_code=204)
async def delete_website(website_id: str, current_user: CurrentUser, db: DBSession):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)
    await website_service.delete_website(website, db)
    # Clean up Supabase Storage — best effort, non-blocking
    await image_service.delete_all_website_images(website_id)


# ── Image upload / delete ──────────────────────────────────────────────────────

@router.get(
    "/storage/health",
    summary="Check Supabase Storage connectivity and bucket access",
)
async def storage_health():
    """Check Supabase Storage health using the new async implementation."""
    return await image_service.check_storage_health()


@router.post(
    "/{website_id}/images/logo",
    response_model=ImageUploadResponse,
    summary="Upload or replace the listing logo",
)
async def upload_logo(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="Logo image (JPEG, PNG, WEBP — max 2 MB)"),
):
    
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)

    url = await image_service.upload_image(
        file=file, website_id=website_id, slot="logo", is_logo=True
    )

    # Persist URL to DB
    website.logo_url = url
    await db.flush()

    current_urls = _split_image_urls(website.image_urls)
    return ImageUploadResponse(
        slot="logo",
        url=url,
        logo_url=url,
        thumbnail_url=current_urls[0] if current_urls else None,
        image_urls=current_urls,
    )


@router.post(
    "/{website_id}/images/thumbnail",
    response_model=ImageUploadResponse,
    summary="Upload or replace the listing cover/thumbnail image",
)
async def upload_thumbnail(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="Cover/thumbnail image (JPEG, PNG, WEBP — max 5 MB)"),
):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)

    url = await image_service.upload_image(
        file=file, website_id=website_id, slot="thumbnail", is_logo=False
    )

    current_urls = _split_image_urls(website.image_urls)
    if current_urls:
        current_urls[0] = url
    else:
        current_urls.append(url)

    website.image_urls = ",".join(current_urls)
    await db.flush()

    return ImageUploadResponse(
        slot="thumbnail",
        url=url,
        logo_url=website.logo_url,
        thumbnail_url=url,
        image_urls=current_urls,
    )


@router.delete(
    "/{website_id}/images/logo",
    status_code=204,
    summary="Delete the listing logo",
)
async def delete_logo(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)
    await image_service.delete_image(website_id, "logo")
    website.logo_url = None
    await db.flush()


@router.delete(
    "/{website_id}/images/thumbnail",
    status_code=204,
    summary="Delete the cover/thumbnail image",
)
async def delete_thumbnail(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)
    await image_service.delete_image(website_id, "thumbnail")

    current_urls = _split_image_urls(website.image_urls)
    if current_urls:
        current_urls.pop(0)
        website.image_urls = ",".join(current_urls) if current_urls else None
        await db.flush()


@router.post(
    "/{website_id}/images",
    response_model=ImageUploadResponse,
    summary="Upload a gallery image (up to 3 per listing)",
)
async def upload_gallery_image(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
    file: UploadFile = File(..., description="Gallery image (JPEG, PNG, WEBP — max 5 MB)"),
):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)

    current_urls = _split_image_urls(website.image_urls)
    max_images   = settings.MAX_IMAGES_PER_WEBSITE

    if len(current_urls) >= max_images:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum {max_images} gallery images allowed. "
                   f"Delete one first via DELETE /{website_id}/images/{{index}}.",
        )

    # Determine next available slot index
    slot_index = len(current_urls)
    slot       = f"img_{slot_index}"

    url = await image_service.upload_image(
        file=file, website_id=website_id, slot=slot, is_logo=False
    )

    current_urls.append(url)
    website.image_urls = ",".join(current_urls)
    await db.flush()

    return ImageUploadResponse(
        slot=slot,
        url=url,
        logo_url=website.logo_url,
        thumbnail_url=current_urls[0] if current_urls else None,
        image_urls=current_urls,
    )


@router.delete(
    "/{website_id}/images/{index}",
    status_code=204,
    summary="Delete a gallery image by index (0-2)",
)
async def delete_gallery_image(
    website_id: str,
    index: int,
    current_user: CurrentUser,
    db: DBSession,
):
    website = await website_service.get_website_owned_by(website_id, current_user.id, db)

    current_urls = _split_image_urls(website.image_urls)

    if index < 0 or index >= len(current_urls):
        raise HTTPException(
            status_code=404,
            detail=f"No image at index {index}. Listing has {len(current_urls)} gallery image(s).",
        )

    slot = f"img_{index}"
    await image_service.delete_image(website_id, slot)

    current_urls.pop(index)
    website.image_urls = ",".join(current_urls) if current_urls else None
    await db.flush()


# ── Admin ──────────────────────────────────────────────────────────────────────

@router.post("/{website_id}/approve", response_model=WebsiteDetailOut)
async def approve_website(website_id: str, admin: AdminUser, db: DBSession):
    website = await website_service.approve_website(website_id, admin, db)
    return await website_service.get_website_by_id(website.id, db)


@router.post("/{website_id}/reject", response_model=WebsiteDetailOut)
async def reject_website(
    website_id: str, payload: RejectWebsite, admin: AdminUser, db: DBSession
):
    website = await website_service.reject_website(website_id, payload, admin, db)
    return await website_service.get_website_by_id(website.id, db)


@router.patch("/{website_id}/admin", response_model=WebsiteDetailOut)
async def admin_update_website(
    website_id: str, payload: WebsiteAdminUpdate, _admin: AdminUser, db: DBSession
):
    website = await website_service.admin_update_website(website_id, payload, db)
    return await website_service.get_website_by_id(website.id, db)
