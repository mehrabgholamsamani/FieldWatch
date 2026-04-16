import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_manager_or_admin
from app.database import get_db
from app.models.report import Priority, ReportStatus
from app.models.user import User
from app.schemas.report import (
    AISuggestNoteResponse,
    ReportCreate,
    ReportListResponse,
    ReportResponse,
    ReportStatsResponse,
    ReportUpdate,
    SimilarReportsResponse,
)
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/stats", response_model=ReportStatsResponse)
async def get_stats(
    _current_user: Annotated[User, Depends(require_manager_or_admin)],
    db: AsyncSession = Depends(get_db),
) -> ReportStatsResponse:
    return await report_service.get_stats(db)


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    data: ReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    return await report_service.create_report(db, data, current_user)


@router.get("/nearby", response_model=list[ReportResponse])
async def get_nearby_reports(
    lat: float,
    lng: float,
    radius: float = Query(default=1000.0, description="Radius in meters"),
    current_user: Annotated[User, Depends(get_current_user)] = ...,  # type: ignore[assignment]
    db: AsyncSession = Depends(get_db),
) -> list[ReportResponse]:
    return await report_service.get_nearby_reports(db, lat, lng, radius, current_user)


@router.get("", response_model=ReportListResponse)
async def list_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    page_size: int = Query(default=20, ge=1, le=200),
    status: ReportStatus | None = Query(default=None),
    priority: Priority | None = Query(default=None),
    sort_by: str = Query(default="newest", pattern="^(newest|oldest|priority)$"),
    assigned_to: uuid.UUID | None = Query(default=None),
) -> ReportListResponse:
    return await report_service.list_reports(
        db,
        current_user,
        cursor,
        page_size,
        status_filter=status,
        priority_filter=priority,
        sort_by=sort_by,
        assigned_to=assigned_to,
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    return await report_service.get_report(db, report_id, current_user)


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: uuid.UUID,
    data: ReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    return await report_service.update_report(db, report_id, data, current_user)


@router.get("/{report_id}/similar", response_model=SimilarReportsResponse)
async def get_similar_reports(
    report_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> SimilarReportsResponse:
    return await report_service.get_similar_reports(db, report_id, current_user)


@router.post("/{report_id}/suggest-note", response_model=AISuggestNoteResponse)
async def suggest_note(
    report_id: uuid.UUID,
    _current_user: Annotated[User, Depends(require_manager_or_admin)],
    db: AsyncSession = Depends(get_db),
) -> AISuggestNoteResponse:
    return await report_service.suggest_note_for_report(db, report_id)
