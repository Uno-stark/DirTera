"""
Notification endpoints.

GET   /notifications                   → list my notifications (paginated)
PATCH /notifications/read-all          → mark all as read
PATCH /notifications/{notification_id}/read → mark one as read

All {notification_id} path parameters are ULID strings.
"""

from __future__ import annotations

import math

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.notification import Notification
from app.schemas.common import PaginatedResponse
from app.schemas.notification import NotificationOut
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=PaginatedResponse[NotificationOut])
async def list_notifications(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
):
    items, total = await notification_service.get_user_notifications(
        current_user.id, db, page, page_size, unread_only
    )
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.patch("/read-all", status_code=204)
async def mark_all_read(current_user: CurrentUser, db: DBSession):
    await notification_service.mark_all_read(current_user.id, db)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_one_read(notification_id: str, current_user: CurrentUser, db: DBSession):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    notif.is_read = True
    await db.flush()
    return notif
