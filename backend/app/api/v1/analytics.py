from __future__ import annotations

import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser, DBSession
from app.models.user import User
from app.models.website import Website
from app.schemas.analytics import (
    AggregatedStats,
    BulkStatsRequest,
    BulkStatsResponse,
    ClickStatResponse,
)
from app.services import analytics_service, website_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _check_access(website: Website, user: User) -> None:

    if user.is_admin:
        return
    if website.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not the owner of this listing.",
        )


# ── Stats (time-series) ───────────────────────────────────────────────────────

@router.post(
    "/bulk-stats",
    response_model=BulkStatsResponse,
    summary="Bulk click totals for a list of websites — admin only",
)
async def get_bulk_stats(
    body: BulkStatsRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    totals = await analytics_service.get_bulk_click_totals(
        body.website_ids, db, body.start_date, body.end_date
    )
    return BulkStatsResponse(stats=totals)


@router.get(
    "/{website_id}/stats",
    response_model=ClickStatResponse,
    summary="Daily click time-series — owner or admin",
)
async def get_click_stats(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
    start_date: Optional[date] = Query(
        None,
        description="YYYY-MM-DD.",
    ),
    end_date: Optional[date] = Query(
        None,
        description="YYYY-MM-DD. Defaults to today.",
    ),
):

    website = await website_service.get_website_by_id(website_id, db)
    _check_access(website, current_user)
    return await analytics_service.get_click_stats(website_id, db, start_date, end_date)


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get(
    "/{website_id}/summary",
    response_model=AggregatedStats,
    summary="Aggregated totals — owner or admin",
)
async def get_summary(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    website = await website_service.get_website_by_id(website_id, db)
    _check_access(website, current_user)
    return await analytics_service.get_aggregated_stats(website_id, db)


# ── CSV export ────────────────────────────────────────────────────────────────

@router.get(
    "/{website_id}/export",
    summary="Download click events CSV — owner or admin",
)
async def export_stats(
    website_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    website = await website_service.get_website_by_id(website_id, db)
    _check_access(website, current_user)
    csv_content = await analytics_service.export_stats_csv(website_id, db)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=clicks_{website_id}.csv"
        },
    )
