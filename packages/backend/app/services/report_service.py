import base64
import json
import math
import uuid
from datetime import datetime, time, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.report import Priority, Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.report import (
    AISuggestNoteResponse,
    ReportCreate,
    ReportListResponse,
    ReportResponse,
    ReportStatsResponse,
    ReportUpdate,
    SimilarReportItem,
    SimilarReportsResponse,
)

PAGE_SIZE = 20


def _encode_cursor(created_at: datetime, report_id: uuid.UUID) -> str:
    data = {"created_at": created_at.isoformat(), "id": str(report_id)}
    return base64.b64encode(json.dumps(data).encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    if len(cursor) > 500:
        raise ValueError("Cursor too long")
    data = json.loads(base64.b64decode(cursor.encode()).decode())
    if not isinstance(data, dict) or "created_at" not in data or "id" not in data:
        raise ValueError("Invalid cursor structure")
    return datetime.fromisoformat(data["created_at"]), uuid.UUID(data["id"])


async def create_report(db: AsyncSession, data: ReportCreate, reporter: User) -> ReportResponse:
    from app.tasks.geocoding_tasks import reverse_geocode

    # Idempotency: return existing report if key already seen
    if data.idempotency_key:
        existing = await db.execute(
            select(Report).where(Report.idempotency_key == data.idempotency_key)
        )
        if existing_report := existing.scalar_one_or_none():
            return ReportResponse.model_validate(existing_report)

    report = Report(
        title=data.title,
        description=data.description,
        priority=data.priority,
        latitude=data.latitude,
        longitude=data.longitude,
        idempotency_key=data.idempotency_key,
        reporter_id=reporter.id,
    )
    db.add(report)
    try:
        await db.commit()
    except IntegrityError:
        # Two concurrent requests raced on the same idempotency_key — return the winner
        await db.rollback()
        existing = await db.execute(
            select(Report).where(Report.idempotency_key == data.idempotency_key)
        )
        existing_report = existing.scalar_one()
        return ReportResponse.model_validate(existing_report)

    # Re-query to trigger selectin loading for reporter/assignee/images relationships
    result = await db.execute(select(Report).where(Report.id == report.id))
    report = result.scalar_one()

    if data.latitude is not None and data.longitude is not None:
        try:
            reverse_geocode.delay(str(report.id), data.latitude, data.longitude)
        except Exception:  # noqa: BLE001
            pass  # Geocoding is best-effort; broker unavailability must not fail the request

    try:
        from app.services import notification_service

        await notification_service.notify_new_report(db, report)
    except Exception:  # noqa: BLE001
        pass  # Notifications are best-effort

    try:
        from app.tasks.ai_tasks import tag_report_task

        tag_report_task.delay(str(report.id), report.title, report.description)
    except Exception:  # noqa: BLE001
        pass  # AI tagging is best-effort

    return ReportResponse.model_validate(report)


async def list_reports(
    db: AsyncSession,
    current_user: User,
    cursor: str | None,
    page_size: int = PAGE_SIZE,
    status_filter: ReportStatus | None = None,
    priority_filter: Priority | None = None,
    sort_by: str = "newest",
    assigned_to: uuid.UUID | None = None,
) -> ReportListResponse:
    filters = []
    if current_user.role == UserRole.REPORTER:
        filters.append(Report.reporter_id == current_user.id)
    if status_filter is not None:
        filters.append(Report.status == status_filter)
    if priority_filter is not None:
        filters.append(Report.priority == priority_filter)
    if assigned_to is not None:
        filters.append(Report.assigned_to_id == assigned_to)

    # Count query
    count_q = select(func.count()).select_from(Report)
    if filters:
        count_q = count_q.where(*filters)
    total = (await db.execute(count_q)).scalar_one()

    # Page query
    q = select(Report)
    if filters:
        q = q.where(*filters)

    if cursor:
        try:
            cursor_dt, cursor_id = _decode_cursor(cursor)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pagination cursor"
            )
        q = q.where(
            or_(
                Report.created_at < cursor_dt,
                and_(Report.created_at == cursor_dt, Report.id < cursor_id),
            )
        )

    if sort_by == "oldest":
        q = q.order_by(Report.created_at.asc(), Report.id.asc())
    elif sort_by == "priority":
        # CRITICAL > HIGH > MEDIUM > LOW — use CASE ordering
        priority_order = case(
            (Report.priority == Priority.CRITICAL, 0),
            (Report.priority == Priority.HIGH, 1),
            (Report.priority == Priority.MEDIUM, 2),
            (Report.priority == Priority.LOW, 3),
            else_=4,
        )
        q = q.order_by(priority_order, Report.created_at.desc())
    else:
        q = q.order_by(Report.created_at.desc(), Report.id.desc())

    q = q.limit(page_size + 1)
    reports = list((await db.execute(q)).scalars().all())

    has_next = len(reports) > page_size
    if has_next:
        reports = reports[:page_size]

    next_cursor = (
        _encode_cursor(reports[-1].created_at, reports[-1].id) if has_next and reports else None
    )

    return ReportListResponse(
        items=[ReportResponse.model_validate(r) for r in reports],
        next_cursor=next_cursor,
        total=total,
    )


async def get_report(
    db: AsyncSession, report_id: uuid.UUID, current_user: User
) -> ReportResponse:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundError("Report not found")
    if current_user.role == UserRole.REPORTER and report.reporter_id != current_user.id:
        raise ForbiddenError("Access denied")
    return ReportResponse.model_validate(report)


async def update_report(
    db: AsyncSession,
    report_id: uuid.UUID,
    data: ReportUpdate,
    current_user: User,
) -> ReportResponse:
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundError("Report not found")
    if current_user.role == UserRole.REPORTER and report.reporter_id != current_user.id:
        raise ForbiddenError("Access denied")

    original_status = report.status

    if data.title is not None:
        report.title = data.title
    if data.description is not None:
        report.description = data.description
    if data.priority is not None:
        report.priority = data.priority

    # Only managers and admins can change status, assignment, and add notes
    if current_user.role != UserRole.REPORTER:
        if data.status is not None:
            report.status = data.status
        if data.assigned_to_id is not None:
            assignee_result = await db.execute(
                select(User).where(User.id == data.assigned_to_id)
            )
            assignee = assignee_result.scalar_one_or_none()
            if not assignee or assignee.role == UserRole.REPORTER:
                raise ForbiddenError("Assignee must be a manager or admin")
            report.assigned_to_id = data.assigned_to_id
        if data.manager_note is not None:
            report.manager_note = data.manager_note

    await db.commit()

    # Re-query to trigger selectin loading for reporter/assignee/images relationships
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one()

    if data.status is not None and data.status != original_status:
        try:
            from app.services import notification_service

            await notification_service.notify_status_change(db, report, data.status.value)
        except Exception:  # noqa: BLE001
            pass  # Notifications are best-effort

    return ReportResponse.model_validate(report)


async def get_nearby_reports(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_meters: float,
    current_user: User,
) -> list[ReportResponse]:
    # Bounding box approximation — works with both SQLite (tests) and PostgreSQL.
    # Production migrations add a PostGIS geography column for exact ST_DWithin queries.
    lat_delta = radius_meters / 111320.0
    lng_delta = radius_meters / (111320.0 * math.cos(math.radians(lat)))

    q = select(Report).where(
        and_(
            Report.latitude.isnot(None),
            Report.longitude.isnot(None),
            Report.latitude >= lat - lat_delta,
            Report.latitude <= lat + lat_delta,
            Report.longitude >= lng - lng_delta,
            Report.longitude <= lng + lng_delta,
        )
    )
    if current_user.role == UserRole.REPORTER:
        q = q.where(Report.reporter_id == current_user.id)

    reports = list((await db.execute(q)).scalars().all())
    return [ReportResponse.model_validate(r) for r in reports]


async def get_stats(db: AsyncSession) -> ReportStatsResponse:
    today_start = datetime.combine(datetime.now(timezone.utc).date(), time.min).replace(
        tzinfo=timezone.utc
    )

    total = (await db.execute(select(func.count()).select_from(Report))).scalar_one()
    pending_review = (
        await db.execute(
            select(func.count()).select_from(Report).where(
                Report.status == ReportStatus.IN_REVIEW
            )
        )
    ).scalar_one()
    resolved_today = (
        await db.execute(
            select(func.count()).select_from(Report).where(
                and_(
                    Report.status == ReportStatus.RESOLVED,
                    Report.updated_at >= today_start,
                )
            )
        )
    ).scalar_one()

    return ReportStatsResponse(
        total=total, pending_review=pending_review, resolved_today=resolved_today
    )


async def get_similar_reports(
    db: AsyncSession,
    report_id: uuid.UUID,
    current_user: User,
) -> SimilarReportsResponse:
    report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
    if not report:
        raise NotFoundError("Report not found")
    if current_user.role == UserRole.REPORTER and report.reporter_id != current_user.id:
        raise ForbiddenError("Access denied")

    if not report.ai_category:
        return SimilarReportsResponse(items=[])

    q = (
        select(Report)
        .where(
            and_(
                Report.ai_category == report.ai_category,
                Report.id != report_id,
                Report.status.notin_([ReportStatus.RESOLVED, ReportStatus.REJECTED]),
            )
        )
        .order_by(Report.created_at.desc())
        .limit(5)
    )
    rows = list((await db.execute(q)).scalars().all())
    return SimilarReportsResponse(items=[SimilarReportItem.model_validate(r) for r in rows])


async def suggest_note_for_report(
    db: AsyncSession,
    report_id: uuid.UUID,
) -> AISuggestNoteResponse:
    import asyncio

    from app.services import ai_service

    report = (await db.execute(select(Report).where(Report.id == report_id))).scalar_one_or_none()
    if not report:
        raise NotFoundError("Report not found")

    similar_notes: list[str] = []
    if report.ai_category:
        q = (
            select(Report.manager_note)
            .where(
                and_(
                    Report.ai_category == report.ai_category,
                    Report.status == ReportStatus.RESOLVED,
                    Report.manager_note.isnot(None),
                    Report.id != report_id,
                )
            )
            .limit(3)
        )
        rows = list((await db.execute(q)).scalars().all())
        similar_notes = [r for r in rows if r]

    suggestion = await asyncio.to_thread(
        ai_service.suggest_note,
        report.title,
        report.description,
        report.priority.value,
        similar_notes,
    )
    return AISuggestNoteResponse(suggestion=suggestion)
