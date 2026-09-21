from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str              # ULID
    title: str
    body: str
    is_read: bool
    website_id: Optional[str] = None   # ULID
    created_at: datetime
