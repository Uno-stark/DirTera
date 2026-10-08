from __future__ import annotations

import csv
import hashlib
import io
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Request
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.click import ClickEvent
from app.models.website import Website
from app.schemas.analytics import AggregatedStats, ClickDataPoint, ClickStatResponse


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    return hashlib.sha256(ip.encode()).hexdigest()


async def record_click(website: Website, request: Request, db: AsyncSession) -> None:
    """Record a click event and increment the denormalised counter."""
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    referrer = request.headers.get("referer")

    event = ClickEvent(
        website_id=website.id,
        ip_hash=_hash_ip(ip),
        user_agent=user_agent[:512] if user_agent else None,
        referrer=referrer[:2048] if referrer else None,
    )
    db.add(event)
    website.total_clicks = (website.total_clicks or 0) + 1
    await db.flush()


async def get_click_stats(
    website_id: str,
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> ClickStatResponse:
    from fastapi import HTTPException, status as http_status

    w_result = await db.execute(select(Website).where(Website.id == website_id))
    website = w_result.scalar_one_or_none()
    if not website:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Website not found")

    now = datetime.now(timezone.utc)
    resolved_end = end_date if end_date is not None else now.date()
    resolved_start = (
        start_date
        if start_date is not None
        else (website.created_at.date() if website.created_at else date(2000, 1, 1))
    )

    if resolved_start > resolved_end:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"start_date ({resolved_start}) must be on or before end_date ({resolved_end}).",
        )

    created_date = website.created_at.date() if website.created_at else date(2000, 1, 1)
    if resolved_start < created_date:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=(
                f"start_date ({resolved_start}) cannot be before the listing's "
                f"creation date ({created_date})."
            ),
        )

    start_dt = datetime.combine(resolved_start, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt   = datetime.combine(resolved_end,   datetime.max.time()).replace(tzinfo=timezone.utc)

    result = await db.execute(
        select(
            func.date(ClickEvent.clicked_at).label("day"),
            func.count(ClickEvent.id).label("cnt"),
        )
        .where(
            ClickEvent.website_id == website_id,
            ClickEvent.clicked_at >= start_dt,
            ClickEvent.clicked_at <= end_dt,
        )
        .group_by(func.date(ClickEvent.clicked_at))
        .order_by(func.date(ClickEvent.clicked_at))
    )
    rows = result.all()

    counts_by_day = {str(row.day): row.cnt for row in rows}
    data: List[ClickDataPoint] = []
    current = resolved_start
    while current <= resolved_end:
        data.append(ClickDataPoint(date=current, clicks=counts_by_day.get(str(current), 0)))
        current += timedelta(days=1)

    total = sum(dp.clicks for dp in data)
    return ClickStatResponse(
        website_id=website_id,
        website_name=website.name,
        total_clicks=total,
        data=data,
    )


async def get_aggregated_stats(website_id: str, db: AsyncSession) -> AggregatedStats:
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), datetime.min.time()).replace(tzinfo=timezone.utc)
    week_start  = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    epoch       = datetime(2000, 1, 1, tzinfo=timezone.utc)

    # Single query — four conditional counts instead of four round-trips
    counts_row = (
        await db.execute(
            select(
                func.count(ClickEvent.id).label("total"),
                func.count(case((ClickEvent.clicked_at >= today_start, 1))).label("today"),
                func.count(case((ClickEvent.clicked_at >= week_start,  1))).label("last7"),
                func.count(case((ClickEvent.clicked_at >= month_start, 1))).label("last30"),
            ).where(
                ClickEvent.website_id == website_id,
                ClickEvent.clicked_at >= epoch,
            )
        )
    ).one()

    ref_result = await db.execute(
        select(ClickEvent.referrer, func.count(ClickEvent.id).label("cnt"))
        .where(ClickEvent.website_id == website_id, ClickEvent.referrer.isnot(None))
        .group_by(ClickEvent.referrer)
        .order_by(func.count(ClickEvent.id).desc())
        .limit(10)
    )
    top_referrers = [{"referrer": r.referrer, "count": r.cnt} for r in ref_result.all()]

    country_result = await db.execute(
        select(ClickEvent.country_code, func.count(ClickEvent.id).label("cnt"))
        .where(ClickEvent.website_id == website_id, ClickEvent.country_code.isnot(None))
        .group_by(ClickEvent.country_code)
        .order_by(func.count(ClickEvent.id).desc())
        .limit(10)
    )
    clicks_by_country = [{"country": r.country_code, "count": r.cnt} for r in country_result.all()]

    return AggregatedStats(
        total_clicks=counts_row.total,
        clicks_today=counts_row.today,
        clicks_last_7_days=counts_row.last7,
        clicks_last_30_days=counts_row.last30,
        top_referrers=top_referrers,
        clicks_by_country=clicks_by_country,
    )


async def get_bulk_click_totals(
    website_ids: list[str],
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict[str, int]:
    """
    Return {website_id: total_clicks} for every id in *website_ids*
    using a single GROUP-BY query instead of one query per site.
    """
    if not website_ids:
        return {}

    now = datetime.now(timezone.utc)
    resolved_end   = end_date   if end_date   is not None else now.date()
    resolved_start = start_date if start_date is not None else date(2000, 1, 1)

    start_dt = datetime.combine(resolved_start, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt   = datetime.combine(resolved_end,   datetime.max.time()).replace(tzinfo=timezone.utc)

    result = await db.execute(
        select(
            ClickEvent.website_id,
            func.count(ClickEvent.id).label("cnt"),
        )
        .where(
            ClickEvent.website_id.in_(website_ids),
            ClickEvent.clicked_at >= start_dt,
            ClickEvent.clicked_at <= end_dt,
        )
        .group_by(ClickEvent.website_id)
    )
    rows = result.all()

    # Seed every requested id with 0 so sites with no clicks still appear
    totals: dict[str, int] = {wid: 0 for wid in website_ids}
    for row in rows:
        totals[row.website_id] = row.cnt
    return totals


async def export_stats_csv(website_id: str, db: AsyncSession) -> str:
    """Return all click events as a CSV string."""
    result = await db.execute(
        select(ClickEvent)
        .where(ClickEvent.website_id == website_id)
        .order_by(ClickEvent.clicked_at.desc())
    )
    events = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "clicked_at", "referrer", "country_code"])
    for e in events:
        writer.writerow([e.id, e.clicked_at.isoformat(), e.referrer or "", e.country_code or ""])
    return output.getvalue()
