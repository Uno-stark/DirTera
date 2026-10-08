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
from typing import Literal

import httpx
from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Allowed input MIME types
_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Image slot type
ImageSlot = Literal["logo", "thumbnail", "img_0", "img_1", "img_2"]

# ── Shared async HTTP client (one per process) ────────────────────────────────
# httpx.AsyncClient is fully async-native and thread-safe.
# We create it lazily to avoid issues at import time.
_http_client: httpx.AsyncClient | None = None


def _storage_headers() -> dict:
    """Build auth + content headers for every Supabase Storage request."""
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
        "apikey": settings.SUPABASE_SECRET_KEY,
    }


def _storage_url(path: str) -> str:
    """Full URL to a Supabase Storage v1 object."""
    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET
    return f"{base}/storage/v1/object/{bucket}/{path}"


def _public_url(storage_path: str) -> str:
    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET
    return f"{base}/storage/v1/object/public/{bucket}/{storage_path}"


async def _client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client


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

    # POST with x-upsert: true → creates or replaces
    headers = {
        **_storage_headers(),
        "Content-Type": "image/webp",
        "x-upsert": "true",
    }

    try:
        http = await _client()
        resp = await http.post(
            _storage_url(storage_path),
            content=compressed,
            headers=headers,
        )
    except httpx.TransportError as exc:
        logger.exception("Network error uploading %s/%s", website_id, slot)
        raise HTTPException(status_code=502, detail=f"Storage network error: {exc}")

    if resp.status_code not in (200, 201):
        logger.error(
            "Storage upload rejected %s/%s — status=%s body=%s",
            website_id, slot, resp.status_code, resp.text[:300],
        )
        raise HTTPException(
            status_code=400,
            detail=f"Storage rejected upload (HTTP {resp.status_code}): {resp.text[:200]}",
        )

    logger.info("Uploaded %s → %s", slot, storage_path)
    return _public_url(storage_path)


async def delete_image(website_id: str, slot: ImageSlot) -> None:
    """Remove a single image slot from Supabase Storage (best-effort)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        return

    storage_path = f"{website_id}/{slot}.webp"
    bucket = settings.SUPABASE_STORAGE_BUCKET
    base = settings.SUPABASE_URL.rstrip("/")
    # Supabase Storage delete API: POST /storage/v1/object/remove/{bucket}
    url = f"{base}/storage/v1/object/remove/{bucket}"

    try:
        http = await _client()
        resp = await http.post(
            url,
            json={"prefixes": [storage_path]},
            headers={
                **_storage_headers(),
                "Content-Type": "application/json",
            },
        )
        if resp.status_code not in (200, 204):
            logger.warning(
                "Storage delete returned %s for %s: %s",
                resp.status_code, storage_path, resp.text[:200],
            )
    except Exception as exc:
        logger.warning("Failed to delete image %s: %s", storage_path, exc)


async def delete_all_website_images(website_id: str) -> None:
    """Best-effort delete of all image slots for a website."""
    slots: list[ImageSlot] = ["logo", "thumbnail", "img_0", "img_1", "img_2"]
    await asyncio.gather(
        *[delete_image(website_id, s) for s in slots],
        return_exceptions=True,
    )
