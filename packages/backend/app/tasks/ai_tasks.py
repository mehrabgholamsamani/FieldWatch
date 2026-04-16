import asyncio
import uuid
from typing import Any

from app.services import ai_service
from app.tasks.celery_app import celery_app


@celery_app.task(  # type: ignore[misc]
    name="tag_report",
    bind=True,
    max_retries=2,
)
def tag_report_task(self: Any, report_id: str, title: str, description: str) -> None:
    try:
        result = ai_service.tag_report(title, description)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30) from exc
    asyncio.run(_save_tags(report_id, result["category"], result["keywords"]))


async def _save_tags(report_id: str, category: str, keywords: str) -> None:
    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.models.report import Report

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
        report = result.scalar_one_or_none()
        if report:
            report.ai_category = category
            report.ai_keywords = keywords
            await db.commit()
