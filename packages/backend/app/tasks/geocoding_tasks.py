import asyncio
import uuid
from typing import Any

from app.services.geocoding_service import reverse_geocode as get_address
from app.tasks.celery_app import celery_app


@celery_app.task(  # type: ignore[misc]
    name="reverse_geocode",
    bind=True,
    max_retries=3,
    rate_limit="1/s",
)
def reverse_geocode(self: Any, report_id: str, lat: float, lng: float) -> None:
    try:
        address = get_address(lat, lng)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=10) from exc

    if address is None:
        # Nominatim returned no result — retry with backoff before giving up
        raise self.retry(
            exc=ValueError(f"Nominatim returned no address for ({lat}, {lng})"),
            countdown=30,
        )

    asyncio.run(_update_report_address(report_id, address))


async def _update_report_address(report_id: str, address: str) -> None:
    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.models.report import Report

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
        report = result.scalar_one_or_none()
        if report:
            report.address = address
            await db.commit()
