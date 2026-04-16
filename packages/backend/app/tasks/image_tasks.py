import asyncio
import os
import uuid
from typing import Any

from PIL import Image

from app.services.image_service import upload_file_to_s3
from app.tasks.celery_app import celery_app

MAX_WIDTH = 1920
THUMBNAIL_SIZE = (300, 300)
JPEG_QUALITY = 80
MAX_PIXELS = 4096 * 4096  # Reject images that decompress to more than ~16MP


@celery_app.task(name="process_image", bind=True, max_retries=3, time_limit=120)  # type: ignore[misc]
def process_image(self: Any, image_id: str, temp_file_path: str) -> dict[str, str]:
    compressed_path = f"{temp_file_path}.compressed.jpg"
    thumb_path = f"{temp_file_path}.thumb.jpg"
    try:
        # Check dimensions before fully decoding — prevents decompression bomb OOM
        with Image.open(temp_file_path) as probe:
            probe.verify()  # Raises on corrupt/truncated files

        with Image.open(temp_file_path) as probe:
            w, h = probe.size
            if w * h > MAX_PIXELS:
                raise ValueError(
                    f"Image dimensions {w}x{h} exceed maximum allowed ({MAX_PIXELS} pixels)"
                )

        with Image.open(temp_file_path) as img:
            img = img.convert("RGB")

            # Compress: resize if wider than MAX_WIDTH
            if img.width > MAX_WIDTH:
                new_height = int(img.height * (MAX_WIDTH / img.width))
                img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)
            img.save(compressed_path, "JPEG", quality=JPEG_QUALITY, optimize=True)

            # Thumbnail
            thumb = img.copy()
            thumb.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            thumb.save(thumb_path, "JPEG", quality=JPEG_QUALITY)

        original_url = upload_file_to_s3(compressed_path, f"images/{image_id}.jpg")
        thumbnail_url = upload_file_to_s3(thumb_path, f"thumbnails/{image_id}.jpg")

        asyncio.run(_update_image_urls(image_id, original_url, thumbnail_url))

        return {"image_id": image_id, "original_url": original_url, "thumbnail_url": thumbnail_url}

    except ValueError:
        # Dimension/format violations should not be retried
        raise

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5) from exc

    finally:
        for path in (temp_file_path, compressed_path, thumb_path):
            try:
                os.remove(path)
            except FileNotFoundError:
                pass


async def _update_image_urls(image_id: str, original_url: str, thumbnail_url: str) -> None:
    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.models.report import ReportImage

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ReportImage).where(ReportImage.id == uuid.UUID(image_id))
        )
        img_record = result.scalar_one_or_none()
        if img_record:
            img_record.original_url = original_url
            img_record.thumbnail_url = thumbnail_url
            await db.commit()
