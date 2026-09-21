"""
User management endpoints.

GET    /users/me               → current user profile
PATCH  /users/me               → update own profile

--- Admin only ---
GET    /users                  → list all users
GET    /users/{user_id}        → get user by ULID
PATCH  /users/{user_id}/admin  → toggle admin / active / verified
DELETE /users/{user_id}        → deactivate user
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Query

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.schemas.common import PaginatedResponse
from app.schemas.user import UserAdminUpdate, UserOut, UserOutAdmin, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


# ── Own profile ───────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(payload: UserUpdate, current_user: CurrentUser, db: DBSession):
    return await user_service.update_user(current_user, payload, db)


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[UserOutAdmin])
async def list_users(
    _admin: AdminUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_admin: Optional[bool] = Query(None),
):
    users, total = await user_service.list_users(db, page, page_size, search, is_admin)
    return PaginatedResponse(
        items=users,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size),
    )


@router.get("/{user_id}", response_model=UserOutAdmin)
async def get_user(user_id: str, _admin: AdminUser, db: DBSession):
    return await user_service.get_user_by_id(user_id, db)


@router.patch("/{user_id}/admin", response_model=UserOutAdmin)
async def admin_update_user(
    user_id: str, payload: UserAdminUpdate, _admin: AdminUser, db: DBSession
):
    return await user_service.admin_update_user(user_id, payload, db)


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(user_id: str, _admin: AdminUser, db: DBSession):
    user = await user_service.get_user_by_id(user_id, db)
    user.is_active = False
    await db.flush()
