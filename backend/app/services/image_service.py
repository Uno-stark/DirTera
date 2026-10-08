"""
Image upload service — Supabase Storage backend.

Uses the sync Supabase client (create_client) with storage operations
off-loaded to threads via asyncio.to_thread(). Pillow WebP compression
also runs in a background thread (CPU-bound).
"""

from __future__ import annotations

import asyncio
import io
import logging
import mimetypes
import threading
from typing import Literal

from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed input MIME types
_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Image slot type
ImageSlot = Literal["logo", "thumbnail", "img_0", "img_1", "img_2"]


# ── Singleton Supabase client ─────────────────────────────────────────────────
_client_lock = threading.Lock()
_supabase = None


def _get_client():
    """Return the process-level sync Supabase client (lazy singleton)."""
    global _supabase
    if _supabase is not None:
        return _supabase
    with _client_lock:
        if _supabase is not None:          # double-checked locking
            return _supabase
        if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image storage is not configured.",
            )
        from supabase import create_client
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
        logger.info(
            "Supabase client initialised (url=%s, bucket=%s)",
            settings.SUPABASE_URL, settings.SUPABASE_STORAGE_BUCKET,
        )
    return _supabase


# ── Validation helpers ────────────────────────────────────────────────────────

def _validate_mime(file: UploadFile) -> None:
    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if mime not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type '{mime}'. Accepted: JPEG, PNG, WEBP, GIF.",
        )


def _validate_size(data: bytes, limit_mb: float) -> None:
    if len(data) > int(limit_mb * 1024 * 1024):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {limit_mb:.0f} MB.",
        )


# ── Pillow compression (CPU-bound → background thread) ───────────────────────

def _compress(data: bytes) -> bytes:
    """Resize + re-encode image to WebP. Runs in asyncio.to_thread()."""
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


# ── Supabase Storage helpers (sync — run inside to_thread) ────────────────────

def _do_upload(storage_path: str, data: bytes) -> None:
    """Upload bytes to Supabase Storage (sync, meant for to_thread)."""
    client = _get_client()
    bucket = settings.SUPABASE_STORAGE_BUCKET
    client.storage.from_(bucket).upload(
        path=storage_path,
        file=data,
        file_options={
            "content-type": "image/webp",
            "upsert": "true",
        },
    )


def _do_remove(paths: list[str]) -> None:
    """Remove files from Supabase Storage (sync, meant for to_thread)."""
    client = _get_client()
    bucket = settings.SUPABASE_STORAGE_BUCKET
    client.storage.from_(bucket).remove(paths)


# ── Public API ────────────────────────────────────────────────────────────────

async def upload_image(
    file: UploadFile,
    website_id: str,
    slot: ImageSlot,
    is_logo: bool = False,
) -> str:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured.",
        )

    _validate_mime(file)
    raw = await file.read()
    _validate_size(raw, settings.MAX_LOGO_SIZE_MB if is_logo else settings.MAX_IMAGE_SIZE_MB)

    # CPU-bound compression in a thread
    try:
        compressed = await asyncio.to_thread(_compress, raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    storage_path = f"{website_id}/{slot}.webp"

    try:
        await asyncio.to_thread(_do_upload, storage_path, compressed)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Storage upload failed — %s/%s", website_id, slot)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Storage upload failed: {exc}",
        )

    public_url = (
        f"{settings.SUPABASE_URL.rstrip('/')}"
        f"/storage/v1/object/public/{settings.SUPABASE_STORAGE_BUCKET}/{storage_path}"
    )
    logger.info("Uploaded %s → %s", slot, storage_path)
    return public_url


async def delete_image(website_id: str, slot: ImageSlot) -> None:
    """Remove a single image slot from Supabase Storage (best-effort)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        return
    storage_path = f"{website_id}/{slot}.webp"
    try:
        await asyncio.to_thread(_do_remove, [storage_path])
    except Exception as exc:
        logger.warning("Failed to delete image %s: %s", storage_path, exc)


async def delete_all_website_images(website_id: str) -> None:
    """Best-effort delete of all image slots for a website."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        return
    bucket = settings.SUPABASE_STORAGE_BUCKET
    paths = [f"{website_id}/{s}.webp" for s in ("logo", "thumbnail", "img_0", "img_1", "img_2")]
    try:
        await asyncio.to_thread(_do_remove, paths)
    except Exception as exc:
        logger.warning("Failed to delete all images for %s: %s", website_id, exc)
