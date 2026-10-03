"""
Authentication endpoints.

GET  /auth/google                  → redirect URL for Google OAuth
POST /auth/google/callback         → exchange code, return JWT
POST /auth/register                → email/password registration
POST /auth/login                   → email/password login
POST /auth/refresh                 → refresh access token
GET  /auth/me                      → current user profile
"""


from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.limiter import limiter
from app.schemas.auth import GoogleCallbackRequest, LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserCreate, UserOut
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
    payload: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    _, tokens = await auth_service.google_login_or_register(code=payload.code, db=db)
    return tokens


# @router.post(
#     "/register",
#     response_model=UserOut,
#     status_code=201,
#     summary="Register with email/password (admin/CLI)",
# )
# @limiter.limit(settings.RATE_LIMIT_AUTH)
# async def register(
#     request: Request,
#     payload: UserCreate,
#     db: AsyncSession = Depends(get_db),
# ):
#     user = await auth_service.register_user(payload, db)
#     return user


# @router.post(
#     "/login",
#     response_model=TokenResponse,
#     summary="Login with email/password (admin/CLI)",
# )
# @limiter.limit(settings.RATE_LIMIT_AUTH)
# async def login(
#     request: Request,
#     payload: LoginRequest,
#     db: AsyncSession = Depends(get_db),
# ):
#     return await auth_service.login_with_password(payload.email, payload.password, db)


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def refresh(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.refresh_access_token(payload.refresh_token, db)


@router.get("/me", response_model=UserOut, summary="Get current user")
async def me(current_user: CurrentUser):
    return current_user
