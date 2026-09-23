from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserAdminUpdate(BaseModel):
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str              # ULID
    is_admin: bool
    is_active: bool
    is_verified: bool
    created_at: datetime


class UserOutAdmin(UserOut):
    """Extended user info visible only to admins."""
    google_id: Optional[str] = None
    updated_at: datetime
