import os
import tempfile
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.report import Report, ReportImage
from app.models.user import User, UserRole
from app.schemas.report import ReportImageResponse
from app.tasks.image_tasks import process_image

router = APIRouter(prefix="/reports", tags=["images"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Magic bytes for allowed image types
_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"RIFF", "image/webp"),  # WebP starts with RIFF....WEBP
]


def _sniff_mime(data: bytes) -> str | None:
    for magic, mime in _MAGIC:
        if data[: len(magic)] == magic:
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return mime
    return None


@router.post(
    "/{report_id}/images",
    response_model=ReportImageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_image(
    report_id: uuid.UUID,
    file: UploadFile,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> ReportImageResponse:
    # Fetch report and check ownership
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if current_user.role == UserRole.REPORTER and report.reporter_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Read and validate file size
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 10 MB)",
        )

    # Validate MIME type via magic bytes (not client-supplied Content-Type)
    detected_mime = _sniff_mime(content)
    if detected_mime not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    # Save to temp file using a safe, fixed extension from detected MIME
    safe_ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }[detected_mime]
    image_id = uuid.uuid4()
    temp_path = os.path.join(tempfile.gettempdir(), f"fw_{image_id}{safe_ext}")
    with open(temp_path, "wb") as f:
        f.write(content)

    # Create placeholder DB record
    img_record = ReportImage(
        id=image_id,
        report_id=report_id,
        original_url="pending",
        thumbnail_url=None,
    )
    db.add(img_record)
    await db.commit()
    await db.refresh(img_record)

    # Queue background processing — if broker is down, roll back the record so it
    # doesn't stay "pending" forever.
    try:
        process_image.delay(str(image_id), temp_path)
    except Exception:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        await db.delete(img_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image processing service is temporarily unavailable. Please try again.",
        )

    return ReportImageResponse.model_validate(img_record)
