"""
Image upload service — Supabase Storage backend.
"""

from __future__ import annotations

import io
import mimetypes
from typing import Literal

from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.core.config import settings

# Allowed input MIME types
_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Image slot type
ImageSlot = Literal["logo", "img_0", "img_1", "img_2"]


def _get_supabase_client():
    """Lazy-init Supabase client — avoids import error when keys are not set."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.",
        )
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)


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


def _compress(data: bytes) -> bytes:
    
    try:
        img = Image.open(io.BytesIO(data))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not read image file. Please upload a valid image.",
        )

    # Strip EXIF / metadata
    img_clean = Image.new(img.mode, img.size)
    img_clean.putdata(list(img.getdata()))

    # Convert RGBA → RGB for WebP (handles PNG with transparency)
    if img_clean.mode in ("RGBA", "P"):
        bg = Image.new("RGB", img_clean.size, (255, 255, 255))
        if img_clean.mode == "P":
            img_clean = img_clean.convert("RGBA")
        bg.paste(img_clean, mask=img_clean.split()[3] if img_clean.mode == "RGBA" else None)
        img_clean = bg
    elif img_clean.mode != "RGB":
        img_clean = img_clean.convert("RGB")

    # Resize: cap longest side at IMAGE_MAX_DIMENSION
    max_dim = settings.IMAGE_MAX_DIMENSION
    w, h = img_clean.size
    if w > max_dim or h > max_dim:
        ratio = min(max_dim / w, max_dim / h)
        img_clean = img_clean.resize(
            (int(w * ratio), int(h * ratio)),
            Image.LANCZOS,
        )

    # Encode as WebP
    buf = io.BytesIO()
    img_clean.save(buf, format="WEBP", quality=settings.IMAGE_WEBP_QUALITY, method=4)
    return buf.getvalue()


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

    compressed = _compress(raw)

    storage_path = f"{website_id}/{slot}.webp"
    bucket = settings.SUPABASE_STORAGE_BUCKET

    client = _get_supabase_client()
    storage = client.storage.from_(bucket)

    # Upsert — overwrite if the slot already exists
    try:
        storage.upload(
            path=storage_path,
            file=compressed,
            file_options={
                "content-type": "image/webp",
                "upsert": "true",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage upload failed: {exc}",
        )

    # Build public URL
    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"
    return public_url


async def delete_image(website_id: str, slot: ImageSlot) -> None:
    """Remove a single image slot from Supabase Storage."""
    storage_path = f"{website_id}/{slot}.webp"
    bucket = settings.SUPABASE_STORAGE_BUCKET
    client = _get_supabase_client()
    try:
        client.storage.from_(bucket).remove([storage_path])
    except Exception:
        pass  


async def delete_all_website_images(website_id: str) -> None:
    
    bucket = settings.SUPABASE_STORAGE_BUCKET
    paths = [
        f"{website_id}/logo.webp",
        f"{website_id}/img_0.webp",
        f"{website_id}/img_1.webp",
        f"{website_id}/img_2.webp",
    ]
    client = _get_supabase_client()
    try:
        client.storage.from_(bucket).remove(paths)
    except Exception:
        pass
