from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    user_id: str,
    title: str,
    body: str,
    db: AsyncSession,
    website_id: Optional[str] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        website_id=website_id,
    )
    db.add(notif)
    await db.flush()
    return notif


async def get_user_notifications(
    user_id: str,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    unread_only: bool = False,
) -> Tuple[List[Notification], int]:
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Notification.created_at.desc())
    )
    rows = (await db.execute(query)).scalars().all()
    return list(rows), total


async def mark_all_read(user_id: str, db: AsyncSession) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
