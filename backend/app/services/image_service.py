"""
Image upload service — Supabase Storage backend.

Uses the async Supabase client (acreate_client) so uploads never block
the event loop. Pillow compression still runs in a thread (CPU-bound).
"""

from __future__ import annotations

import asyncio
import io
import logging
import mimetypes
from typing import Literal, Optional

from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed input MIME types
_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Image slot type
ImageSlot = Literal["logo", "thumbnail", "img_0", "img_1", "img_2"]

# ── Async Supabase client singleton ──────────────────────────────────────────
# One client per process. acreate_client uses httpx.AsyncClient natively —
# no threads, no event-loop blocking.
_async_client = None
_client_lock = asyncio.Lock()


async def _get_async_client():
    """Return (or lazily create) the process-level async Supabase client."""
    global _async_client
    if _async_client is not None:
        return _async_client
    async with _client_lock:
        if _async_client is not None:
            return _async_client
        if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.",
            )
        from supabase import acreate_client
        _async_client = await acreate_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SECRET_KEY,
        )
        logger.info(
            "Async Supabase client initialised (url=%s, bucket=%s)",
            settings.SUPABASE_URL,
            settings.SUPABASE_STORAGE_BUCKET,
        )
    return _async_client


# ── Validation helpers ────────────────────────────────────────────────────────

def _validate_mime(file: UploadFile) -> None:
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if mime not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type '{mime}'. Accepted: JPEG, PNG, WEBP, GIF.",
        )


def _validate_size(data: bytes, limit_mb: float) -> None:
    limit_bytes = int(limit_mb * 1024 * 1024)
    if len(data) > limit_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {limit_mb:.0f} MB.",
        )


# ── Pillow compression (CPU-bound, runs in thread) ────────────────────────────

def _compress(data: bytes) -> bytes:
    """Compress raw image bytes to WebP in a background thread."""
    try:
        img = Image.open(io.BytesIO(data))
    except Exception as exc:
        raise ValueError(f"Could not read image: {exc}")

    # Convert colour mode while preserving transparency for WebP
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Cap longest side at IMAGE_MAX_DIMENSION
    max_dim = settings.IMAGE_MAX_DIMENSION
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=settings.IMAGE_WEBP_QUALITY, method=4)
    return buf.getvalue()


# ── Public API ────────────────────────────────────────────────────────────────

async def upload_image(
    file: UploadFile,
    website_id: str,
    slot: ImageSlot,
    is_logo: bool = False,
) -> str:
    _validate_mime(file)

    raw = await file.read()
    limit = settings.MAX_LOGO_SIZE_MB if is_logo else settings.MAX_IMAGE_SIZE_MB
    _validate_size(raw, limit)

    # CPU-bound: compress in thread to keep event loop free
    try:
        compressed = await asyncio.to_thread(_compress, raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    storage_path = f"{website_id}/{slot}.webp"
    bucket = settings.SUPABASE_STORAGE_BUCKET

    try:
        client = await _get_async_client()
        await client.storage.from_(bucket).upload(
            path=storage_path,
            file=compressed,
            file_options={
                "content-type": "image/webp",
                "upsert": "true",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Storage upload failed — website_id=%s slot=%s path=%s",
            website_id,
            slot,
            storage_path,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Storage upload failed: {exc}",
        )

    public_url = (
        f"{settings.SUPABASE_URL.rstrip('/')}"
        f"/storage/v1/object/public/{bucket}/{storage_path}"
    )
    return public_url


async def delete_image(website_id: str, slot: ImageSlot) -> None:
    """Remove a single image slot from Supabase Storage (best-effort)."""
    storage_path = f"{website_id}/{slot}.webp"
    bucket = settings.SUPABASE_STORAGE_BUCKET
    try:
        client = await _get_async_client()
        await client.storage.from_(bucket).remove([storage_path])
    except Exception as exc:
        logger.warning("Failed to delete image %s: %s", storage_path, exc)


async def delete_all_website_images(website_id: str) -> None:
    bucket = settings.SUPABASE_STORAGE_BUCKET
    paths = [
        f"{website_id}/logo.webp",
        f"{website_id}/thumbnail.webp",
        f"{website_id}/img_0.webp",
        f"{website_id}/img_1.webp",
        f"{website_id}/img_2.webp",
    ]
    try:
        client = await _get_async_client()
        await client.storage.from_(bucket).remove(paths)
    except Exception as exc:
        logger.warning("Failed to delete all images for %s: %s", website_id, exc)
