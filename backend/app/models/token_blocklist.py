from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import ULIDPrimaryKey


class TokenBlocklist(ULIDPrimaryKey, Base):
    """
    Stores the `jti` (JWT ID) of invalidated access tokens so that
    POST /auth/logout takes immediate effect even before the token
    would naturally expire.

    Rows whose `expires_at` is in the past can be pruned safely —
    expired tokens are rejected by the JWT decoder before the
    blocklist is consulted.
    """

    __tablename__ = "token_blocklist"

    jti: Mapped[str] = mapped_column(
        String(36),
        unique=True,
        nullable=False,
        index=True,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
