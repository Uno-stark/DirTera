"""
Image upload service — Supabase Storage backend.

Uses async httpx for non-blocking I/O to Supabase Storage API.
Pillow WebP compression runs in a background thread (CPU-bound).
Includes exponential backoff retry for transient network failures.

The module-level `_http_client` is a long-lived AsyncClient initialised by
`init_http_client()` (called from the FastAPI lifespan) and torn down by
`close_http_client()`.  Reusing a single client across requests lets httpx
pool and reuse TCP/TLS connections to Supabase, eliminating the per-request
handshake overhead.
"""

from __future__ import annotations

import asyncio
import io
import logging
import mimetypes
from typing import Literal

import httpx
from fastapi import HTTPException, UploadFile, status
from PIL import Image
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed input MIME types
_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Image slot type
ImageSlot = Literal["logo", "thumbnail", "img_0", "img_1", "img_2"]

# HTTP client timeout
_UPLOAD_TIMEOUT = 30.0

# ── Shared HTTP client (lifespan-managed) ─────────────────────────────────────

_http_client: httpx.AsyncClient | None = None


def init_http_client() -> None:
    """Create the shared AsyncClient. Call once from the FastAPI lifespan."""
    global _http_client
    _http_client = httpx.AsyncClient(
        timeout=_UPLOAD_TIMEOUT,
        limits=httpx.Limits(
            max_keepalive_connections=10,
            max_connections=20,
            keepalive_expiry=30,
        ),
    )
    logger.debug("Shared httpx client initialised")


async def close_http_client() -> None:
    """Gracefully close the shared AsyncClient. Call from the FastAPI lifespan teardown."""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
        logger.debug("Shared httpx client closed")


def _get_client() -> httpx.AsyncClient:
    """Return the shared client, falling back to a temporary one if not yet initialised."""
    if _http_client is not None:
        return _http_client
    # Fallback: prevents hard crashes during testing or unusual startup sequences.
    logger.warning("Shared httpx client not initialised — using a temporary client")
    return httpx.AsyncClient(timeout=_UPLOAD_TIMEOUT)


# ── Validation helpers ────────────────────────────────────────────────────────

def _validate_mime(file: UploadFile) -> None:
    """Validate that the uploaded file is an allowed image type."""
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if mime not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type '{mime}'. Accepted: JPEG, PNG, WEBP, GIF.",
        )

def _validate_size(data: bytes, limit_mb: float) -> None:
    """Validate that the file size is within limits."""
    if len(data) > int(limit_mb * 1024 * 1024):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {limit_mb:.0f} MB.",
        )

# ── Pillow compression (CPU-bound → background thread) ───────────────────────

def _compress(data: bytes) -> bytes:
    """
    Resize and re-encode image to WebP format.
    Runs in asyncio.to_thread() to avoid blocking the event loop.
    """
    try:
        img = Image.open(io.BytesIO(data))
    except Exception as exc:
        raise ValueError(f"Could not read image: {exc}")

    # Ensure correct colour mode for WebP
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Cap longest side
    max_dim = settings.IMAGE_MAX_DIMENSION
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=settings.IMAGE_WEBP_QUALITY, method=4)
    return buf.getvalue()

# ── Async Supabase Storage operations ─────────────────────────────────────────

@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)
async def _do_upload_async(storage_path: str, data: bytes) -> None:
    """
    Upload bytes to Supabase Storage using the shared async HTTP client.
    Includes automatic retry with exponential backoff for network errors.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured.",
        )

    bucket = settings.SUPABASE_STORAGE_BUCKET
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{storage_path}"

    # New Supabase secret keys (sb_secret_xxx) must use the apikey header, not Authorization.
    # Legacy service_role JWT keys can use either, but apikey is the forward-compatible approach.
    headers = {
        "apikey": settings.SUPABASE_SECRET_KEY,
        "Content-Type": "image/webp",
        "x-upsert": "true",  # Overwrite if exists
    }

    client = _get_client()
    try:
        response = await client.post(url, content=data, headers=headers)
        response.raise_for_status()
        logger.debug("Uploaded to Supabase: %s (%d bytes)", storage_path, len(data))
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Supabase upload failed: %s - Status %d - %s",
            storage_path,
            exc.response.status_code,
            exc.response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Storage upload failed: {exc.response.text}",
        )
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        logger.warning("Network error uploading %s: %s (will retry)", storage_path, exc)
        raise  # Let tenacity retry

@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)
async def _do_remove_async(paths: list[str]) -> None:
    """
    Remove files from Supabase Storage using async HTTP.
    Best-effort operation - failures are logged but not raised.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        return

    if not paths:
        return

    bucket = settings.SUPABASE_STORAGE_BUCKET
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}"

    headers = {
        "apikey": settings.SUPABASE_SECRET_KEY,
        "Content-Type": "application/json",
    }

    # Supabase expects {"prefixes": ["path1", "path2"]}
    payload = {"prefixes": paths}

    client = _get_client()
    try:
        response = await client.delete(url, headers=headers, json=payload)
        response.raise_for_status()
        logger.debug("Deleted from Supabase: %s", paths)
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Supabase delete failed: %s - Status %d",
            paths,
            exc.response.status_code,
        )
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        logger.warning("Network error deleting %s: %s", paths, exc)
        raise  # Let tenacity retry

# ── Public API ────────────────────────────────────────────────────────────────

async def upload_image(
    file: UploadFile,
    website_id: str,
    slot: ImageSlot,
    is_logo: bool = False,
) -> str:
    """
    Upload and process an image for a website listing.

    Args:
        file: The uploaded file (JPEG, PNG, WEBP, or GIF)
        website_id: The website ID (used in storage path)
        slot: The image slot (logo, thumbnail, img_0, img_1, img_2)
        is_logo: If True, applies logo size limits (2MB vs 5MB)

    Returns:
        The public URL of the uploaded image

    Raises:
        HTTPException: If validation fails or upload fails
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured.",
        )

    # Validate MIME type
    _validate_mime(file)

    # Read file into memory
    raw = await file.read()

    # Validate size
    size_limit = settings.MAX_LOGO_SIZE_MB if is_logo else settings.MAX_IMAGE_SIZE_MB
    _validate_size(raw, size_limit)

    # CPU-bound compression in a background thread (non-blocking)
    try:
        compressed = await asyncio.to_thread(_compress, raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Construct storage path
    storage_path = f"{website_id}/{slot}.webp"

    # Upload to Supabase (async, with retry)
    try:
        await _do_upload_async(storage_path, compressed)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error uploading %s/%s", website_id, slot)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage upload failed: {exc}",
        )

    # Construct public URL
    public_url = (
        f"{settings.SUPABASE_URL.rstrip('/')}"
        f"/storage/v1/object/public/{settings.SUPABASE_STORAGE_BUCKET}/{storage_path}"
    )

    logger.info("Uploaded %s → %s (%.1f KB)", slot, storage_path, len(compressed) / 1024)
    return public_url

async def delete_image(website_id: str, slot: ImageSlot) -> None:
    """
    Remove a single image slot from Supabase Storage.
    Best-effort operation - failures are logged but not raised.

    Args:
        website_id: The website ID
        slot: The image slot to delete
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        return

    storage_path = f"{website_id}/{slot}.webp"

    try:
        await _do_remove_async([storage_path])
    except Exception as exc:
        logger.warning("Failed to delete image %s: %s", storage_path, exc)

async def delete_all_website_images(website_id: str) -> None:
    """
    Delete all image slots for a website.
    Best-effort operation - failures are logged but not raised.

    Args:
        website_id: The website ID
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        return

    paths = [f"{website_id}/{s}.webp" for s in ("logo", "thumbnail", "img_0", "img_1", "img_2")]

    try:
        await _do_remove_async(paths)
    except Exception as exc:
        logger.warning("Failed to delete all images for %s: %s", website_id, exc)

# ── Health check helper ───────────────────────────────────────────────────────

async def check_storage_health() -> dict[str, any]:
    """
    Check Supabase Storage connectivity and bucket access.
    Used by the /websites/storage/health endpoint.

    Returns:
        Dictionary with status and diagnostic information
    """
    url_set = bool(settings.SUPABASE_URL)
    key_set = bool(settings.SUPABASE_SECRET_KEY)
    bucket = settings.SUPABASE_STORAGE_BUCKET

    result = {
        "supabase_url_configured": url_set,
        "supabase_url": settings.SUPABASE_URL if url_set else None,
        "supabase_key_configured": key_set,
        "supabase_key_prefix": (
            settings.SUPABASE_SECRET_KEY[:8] + "..." if key_set else None
        ),
        "bucket": bucket,
    }

    if not url_set or not key_set:
        return {
            **result,
            "status": "error",
            "detail": "SUPABASE_URL or SUPABASE_SECRET_KEY not set",
        }

    # Try to query bucket info
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/bucket/{bucket}"
    headers = {"apikey": settings.SUPABASE_SECRET_KEY}

    try:
        client = _get_client()
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        bucket_info = response.json()
        return {
            **result,
            "status": "ok",
            "bucket_info": bucket_info,
        }
    except Exception as exc:
        return {
            **result,
            "status": "error",
            "error": str(exc),
        }
