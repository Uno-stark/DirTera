from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserAdminUpdate, UserUpdate


async def get_user_by_id(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def update_user(user: User, payload: UserUpdate, db: AsyncSession) -> User:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    return user


async def admin_update_user(user_id: str, payload: UserAdminUpdate, db: AsyncSession) -> User:
    user = await get_user_by_id(user_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    return user


async def list_users(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    is_admin: Optional[bool] = None,
) -> Tuple[List[User], int]:
    query = select(User)
    if search:
        like = f"%{search}%"
        query = query.where(
            (User.email.ilike(like)) | (User.full_name.ilike(like))
        )
    if is_admin is not None:
        query = query.where(User.is_admin == is_admin)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(User.created_at.desc())
    )
    rows = (await db.execute(query)).scalars().all()
    return list(rows), total
