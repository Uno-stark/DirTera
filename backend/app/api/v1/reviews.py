"""
Review / rating endpoints — future-ready.

POST   /reviews/{website_id}           → leave a review (logged-in users)
GET    /reviews/{website_id}           → list reviews for a website (public)
PATCH  /reviews/{review_id}            → edit own review
DELETE /reviews/{review_id}            → delete own review

--- Admin ---
DELETE /reviews/{review_id}/admin      → remove any review
PATCH  /reviews/{review_id}/hide       → hide/show a review

All {website_id} and {review_id} path parameters are ULID strings.
"""

from __future__ import annotations

import math

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.models.review import Review
from app.models.website import Website
from app.schemas.common import PaginatedResponse
from app.schemas.review import ReviewCreate, ReviewOut, ReviewUpdate

router = APIRouter(prefix="/reviews", tags=["Reviews"])


async def _recalc_rating(website_id: str, db) -> None:
    """Recompute avg_rating and review_count on the website row."""
    result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.website_id == website_id,
            Review.is_visible == True,  # noqa: E712
        )
    )
    avg, count = result.one()
    w = await db.get(Website, website_id)
    if w:
        w.avg_rating = round(float(avg or 0), 2)
        w.review_count = count or 0


@router.post("/{website_id}", response_model=ReviewOut, status_code=201)
async def create_review(
    website_id: str,
    payload: ReviewCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    existing = await db.execute(
        select(Review).where(
            Review.website_id == website_id,
            Review.author_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this website",
        )

    review = Review(
        author_id=current_user.id,
        website_id=website_id,
        rating=payload.rating,
        body=payload.body,
    )
    db.add(review)
    await db.flush()
    await _recalc_rating(website_id, db)
    return review


@router.get("/{website_id}", response_model=PaginatedResponse[ReviewOut])
async def list_reviews(
    website_id: str,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = select(Review).where(
        Review.website_id == website_id,
        Review.is_visible == True,  # noqa: E712
    )
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()
    query = query.offset((page - 1) * page_size).limit(page_size).order_by(
        Review.created_at.desc()
    )
    rows = (await db.execute(query)).scalars().all()
    return PaginatedResponse(
        items=list(rows), total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.patch("/{review_id}", response_model=ReviewOut)
async def update_review(
    review_id: str,
    payload: ReviewUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    result = await db.execute(
        select(Review).where(
            Review.id == review_id,
            Review.author_id == current_user.id,
        )
    )
    review = result.scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(review, field, value)
    await db.flush()
    await _recalc_rating(review.website_id, db)
    return review


@router.delete("/{review_id}", status_code=204)
async def delete_review(review_id: str, current_user: CurrentUser, db: DBSession):
    result = await db.execute(
        select(Review).where(
            Review.id == review_id,
            Review.author_id == current_user.id,
        )
    )
    review = result.scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    website_id = review.website_id
    await db.delete(review)
    await db.flush()
    await _recalc_rating(website_id, db)


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.delete("/{review_id}/admin", status_code=204)
async def admin_delete_review(review_id: str, _admin: AdminUser, db: DBSession):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    website_id = review.website_id
    await db.delete(review)
    await db.flush()
    await _recalc_rating(website_id, db)


@router.patch("/{review_id}/hide", response_model=ReviewOut)
async def toggle_review_visibility(
    review_id: str,
    hide: bool = Query(..., description="true to hide, false to show"),
    _admin: AdminUser = None,
    db: DBSession = None,
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    review.is_visible = not hide
    await db.flush()
    await _recalc_rating(review.website_id, db)
    return review
