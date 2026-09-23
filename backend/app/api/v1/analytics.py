from __future__ import annotations

import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser, DBSession
from app.schemas.analytics import AggregatedStats, ClickStatResponse
from app.services import analytics_service, website_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _assert_owner(website, user_id: str) -> None:
    if website.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.get("/{website_id}/stats", response_model=ClickStatResponse)
async def get_click_stats(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
    start_date: Optional[date] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[date] = Query(None, description="YYYY-MM-DD"),
):
    """Daily click breakdown for the given date range (default: last 30 days)."""
    website = await website_service.get_website_by_id(website_id, db)
    _assert_owner(website, current_user.id)
    return await analytics_service.get_click_stats(website_id, db, start_date, end_date)


@router.get("/{website_id}/summary", response_model=AggregatedStats)
async def get_summary(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """High-level totals: today, last 7d, last 30d, top referrers, countries."""
    website = await website_service.get_website_by_id(website_id, db)
    _assert_owner(website, current_user.id)
    return await analytics_service.get_aggregated_stats(website_id, db)


@router.get("/{website_id}/export")
async def export_stats(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """Download a CSV of all click events for this website."""
    website = await website_service.get_website_by_id(website_id, db)
    _assert_owner(website, current_user.id)
    csv_content = await analytics_service.export_stats_csv(website_id, db)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=clicks_{website_id}.csv"},
    )
