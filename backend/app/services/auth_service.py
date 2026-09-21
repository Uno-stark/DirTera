from __future__ import annotations

from typing import Optional, Tuple

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


async def get_google_user_info(code: str) -> dict:
    """Exchange auth code for tokens then fetch user profile from Google."""
    async with httpx.AsyncClient() as client:
        # Exchange code → access_token
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google token exchange failed: {token_resp.text}",
            )
        token_data = token_resp.json()
        g_access_token = token_data.get("access_token")

        # Fetch user info
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {g_access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch Google user info",
            )
        return userinfo_resp.json()


async def google_login_or_register(
    code: str, db: AsyncSession
) -> Tuple[User, TokenResponse]:
    """Given an OAuth code, find or create the user, return JWT tokens."""
    info = await get_google_user_info(code)

    google_id: str = info["sub"]
    email: str = info["email"]
    full_name: str = info.get("name", "")
    avatar_url: str = info.get("picture", "")

    # Try by google_id first, then fall back to email
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user is None:
        # New user — create
        user = User(
            email=email,
            full_name=full_name,
            avatar_url=avatar_url,
            google_id=google_id,
            is_verified=True,  # Google email is already verified
        )
        db.add(user)
        await db.flush()
    else:
        # Merge Google ID if this account previously registered by email
        if user.google_id is None:
            user.google_id = google_id
        user.avatar_url = user.avatar_url or avatar_url
        user.full_name = user.full_name or full_name

    tokens = TokenResponse(
        access_token=create_access_token(user.id, user.is_admin),
        refresh_token=create_refresh_token(user.id),
    )
    return user, tokens


async def login_with_password(
    email: str, password: str, db: AsyncSession
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    return TokenResponse(
        access_token=create_access_token(user.id, user.is_admin),
        refresh_token=create_refresh_token(user.id),
    )


async def register_user(payload: UserCreate, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()
    return user


async def refresh_access_token(refresh_token: str, db: AsyncSession) -> TokenResponse:
    from jose import JWTError

    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id: str = payload["sub"]   # ULID string
        if not user_id:
            raise ValueError("Empty sub claim")
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id, user.is_admin),
        refresh_token=create_refresh_token(user.id),
    )
