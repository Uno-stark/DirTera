from __future__ import annotations

from functools import lru_cache
from typing import Any, List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "DirTera"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-in-production"
    ENVIRONMENT: str = "development"

    # ── CORS 
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    @property
    def allowed_origins_list(self) -> List[str]:
        """Use this in middleware — returns a proper list."""
        raw = self.ALLOWED_ORIGINS.strip()
        if raw.startswith("["):
            import json
            return json.loads(raw)
        return [o.strip() for o in raw.split(",") if o.strip()]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./dirterra.db"

    # Pool settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 300

    # JWT
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = (
        "http://localhost:8000/api/v1/auth/google/callback"
    )

    # links.et Payment
    LINKSSET_API_KEY: str = ""

    # Supabase Storage
    SUPABASE_URL: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "website-images"
    SUPABASE_BUCKET: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.SUPABASE_SECRET_KEY:
            self.SUPABASE_SECRET_KEY = (
                self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_KEY or ""
            )
        if self.SUPABASE_BUCKET and self.SUPABASE_STORAGE_BUCKET == "website-images":
            self.SUPABASE_STORAGE_BUCKET = self.SUPABASE_BUCKET

    # Image limits
    MAX_LOGO_SIZE_MB: float = 2.0
    MAX_IMAGE_SIZE_MB: float = 5.0
    MAX_IMAGES_PER_WEBSITE: int = 3
    IMAGE_MAX_DIMENSION: int = 1920
    IMAGE_WEBP_QUALITY: int = 82

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # ── Rate limiting 
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_GLOBAL: str = "200/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_PAYMENT: str = "5/minute"
    RATE_LIMIT_CLICK: str = "60/minute"
    RATE_LIMIT_REVIEW: str = "10/minute"
    REDIS_URL: Optional[str] = None
    CACHE_BACKEND: str = "memory"
    CACHE_TTL_SECONDS: int = 60

    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: str = "noreply@dirterra.et"
    EMAILS_FROM_NAME: str = "DirTera"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()