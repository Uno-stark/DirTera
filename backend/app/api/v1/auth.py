"""
Authentication endpoints.

GET  /auth/google          → redirect URL for Google OAuth
GET  /auth/google/callback → browser OAuth callback (redirects to frontend)
POST /auth/google/callback → exchange code for JWT (SPA flow)
POST /auth/refresh         → refresh access token
GET  /auth/me              → current user profile
"""

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.limiter import limiter
from app.schemas.auth import GoogleCallbackRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])

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
