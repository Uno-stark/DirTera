"""
Authentication endpoints.

GET  /auth/google          → redirect URL for Google OAuth
GET  /auth/google/callback → browser OAuth callback (redirects to frontend)
POST /auth/google/callback → exchange code for JWT (SPA flow)
POST /auth/refresh         → refresh access token
GET  /auth/me              → current user profile
POST /auth/logout          → revoke current access token (server-side blocklist)
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.limiter import limiter
from app.core.security import decode_token
from app.models.token_blocklist import TokenBlocklist
from app.schemas.auth import GoogleCallbackRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])

_bearer = HTTPBearer(auto_error=False)   # used only in the logout endpoint

GOOGLE_AUTH_URL = (
    "https://accounts.google.com/o/oauth2/v2/auth"
    "?response_type=code"
    "&scope=openid%20email%20profile"
    f"&client_id={settings.GOOGLE_CLIENT_ID}"
    f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
    "&access_type=offline"
    "&prompt=consent"
)


@router.get("/google", summary="Get Google OAuth redirect URL")
async def google_auth_url():
    return {"url": GOOGLE_AUTH_URL}


@router.get("/google/callback", summary="Browser Google OAuth callback")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def google_callback_redirect(
    request: Request,
    response: Response,
    code: str,
    db: AsyncSession = Depends(get_db),
):
    _, tokens = await auth_service.google_login_or_register(code=code, db=db)
    frontend_url = settings.allowed_origins_list[1]
    return RedirectResponse(
        url=f"{frontend_url}/auth/callback"
            f"?access_token={tokens.access_token}"
            f"&refresh_token={tokens.refresh_token}"
    )


@router.post(
    "/google/callback",
    response_model=TokenResponse,
    summary="Exchange Google code for JWT (SPA)",
)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def google_callback_api(
    request: Request,
    response: Response,
    payload: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    _, tokens = await auth_service.google_login_or_register(code=payload.code, db=db)
    return tokens


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def refresh(
    request: Request,
    response: Response,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.refresh_access_token(payload.refresh_token, db)


@router.get("/me", response_model=UserOut, summary="Get current user")
async def me(current_user: CurrentUser):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke access token")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def logout(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Adds the token's `jti` to the blocklist so it is rejected on all subsequent
    requests even before its natural expiry time.

    Always returns 204 — including when no token was supplied or the token is
    already expired/invalid — so the client can safely clear its local storage
    regardless of server state.
    """
    if credentials is None:
        return  # no token supplied — nothing to revoke, still a success

    try:
        payload = decode_token(credentials.credentials)
        jti: str | None = payload.get("jti")
        exp: int | None = payload.get("exp")

        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            existing = await db.execute(
                sa_select(TokenBlocklist).where(TokenBlocklist.jti == jti)
            )
            if existing.scalar_one_or_none() is None:
                db.add(TokenBlocklist(jti=jti, expires_at=expires_at))
                await db.commit()
    except (JWTError, Exception):
        # Expired / invalid tokens: nothing useful to blocklist, just return 204
        pass
