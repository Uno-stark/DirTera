from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel


class ClickDataPoint(BaseModel):
    date: date
    clicks: int


class ClickStatResponse(BaseModel):
    website_id: str      # ULID
    website_name: str
    total_clicks: int
    data: List[ClickDataPoint]


class AggregatedStats(BaseModel):
    total_clicks: int
    clicks_today: int
    clicks_last_7_days: int
    clicks_last_30_days: int
    top_referrers: List[dict]
    clicks_by_country: List[dict]


class BulkStatsRequest(BaseModel):
    website_ids: List[str]
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class BulkStatsResponse(BaseModel):
    # website_id → total clicks in the requested range
    stats: Dict[str, int]
