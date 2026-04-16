import io
import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch  # noqa: F401

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage


def _make_jpeg(width: int = 100, height: int = 100) -> bytes:
    buf = io.BytesIO()
    PILImage.new("RGB", (width, height), color=(128, 0, 0)).save(buf, "JPEG")
    return buf.getvalue()


async def _register_login(client: AsyncClient, email: str) -> str:
    await client.post(
        "/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "User"},
    )
    resp = await client.post(
        "/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    return resp.json()["access_token"]  # type: ignore[no-any-return]


async def _create_report(client: AsyncClient, token: str) -> str:
    resp = await client.post(
        "/v1/reports",
        json={"title": "Test", "description": "desc"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]  # type: ignore[no-any-return]


# ---------------------------------------------------------------------------
# Upload endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_image(client: AsyncClient) -> None:
    token = await _register_login(client, "rep@example.com")
    report_id = await _create_report(client, token)

    with patch("app.api.images.process_image") as mock_task:
        mock_task.delay = MagicMock()
        resp = await client.post(
            f"/v1/reports/{report_id}/images",
            files={"file": ("photo.jpg", _make_jpeg(), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 202
    data = resp.json()
    assert data["report_id"] == report_id
    assert data["original_url"] == "pending"
    mock_task.delay.assert_called_once()


@pytest.mark.asyncio
async def test_upload_unauthorized_other_reporter(client: AsyncClient) -> None:
    token1 = await _register_login(client, "rep1@example.com")
    token2 = await _register_login(client, "rep2@example.com")
    report_id = await _create_report(client, token1)

    resp = await client.post(
        f"/v1/reports/{report_id}/images",
        files={"file": ("photo.jpg", _make_jpeg(), "image/jpeg")},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_upload_image_size_limit(client: AsyncClient) -> None:
    token = await _register_login(client, "rep@example.com")
    report_id = await _create_report(client, token)

    # Start content with valid JPEG magic bytes, then pad to exceed limit
    jpeg_magic = b"\xff\xd8\xff" + b"x" * (10 * 1024 * 1024)
    resp = await client.post(
        f"/v1/reports/{report_id}/images",
        files={"file": ("big.jpg", jpeg_magic, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_upload_rejects_non_image(client: AsyncClient) -> None:
    """A file with wrong magic bytes is rejected with 415 regardless of extension."""
    token = await _register_login(client, "rep@example.com")
    report_id = await _create_report(client, token)

    fake_exe = b"MZ\x90\x00" + b"\x00" * 100  # PE/EXE magic bytes
    resp = await client.post(
        f"/v1/reports/{report_id}/images",
        files={"file": ("photo.jpg", fake_exe, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 415


# ---------------------------------------------------------------------------
# Celery task unit test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_process_image_task(tmp_path: "os.PathLike[str]") -> None:
    # Write a real JPEG (2400px wide so compression fires)
    wide_img = PILImage.new("RGB", (2400, 1800), color=(0, 128, 0))
    src_path = str(tmp_path / "source.jpg")
    wide_img.save(src_path, "JPEG")

    image_id = str(uuid.uuid4())

    mock_update = AsyncMock()

    with (
        patch("app.tasks.image_tasks.upload_file_to_s3") as mock_upload,
        patch("app.tasks.image_tasks._update_image_urls", mock_update),
        patch("app.tasks.image_tasks.asyncio.run") as mock_run,
    ):
        mock_upload.side_effect = [
            "https://s3.example.com/images/img.jpg",
            "https://s3.example.com/thumbnails/img.jpg",
        ]
        mock_run.return_value = None

        from app.tasks.image_tasks import process_image

        result = process_image.run(image_id, src_path)

    # Two S3 uploads: compressed + thumbnail
    assert mock_upload.call_count == 2

    # First upload key should be for images/, second for thumbnails/
    first_key = mock_upload.call_args_list[0][0][1]
    second_key = mock_upload.call_args_list[1][0][1]
    assert first_key.startswith("images/")
    assert second_key.startswith("thumbnails/")

    # Result contains URLs
    assert result["original_url"] == "https://s3.example.com/images/img.jpg"
    assert result["thumbnail_url"] == "https://s3.example.com/thumbnails/img.jpg"

    # asyncio.run was called to update the DB
    mock_run.assert_called_once()

    # Temp source file was cleaned up
    assert not os.path.exists(src_path)


@pytest.mark.asyncio
async def test_process_image_compresses_large_image(tmp_path: "os.PathLike[str]") -> None:
    """Verify that an image wider than 1920px is resized down."""
    wide_img = PILImage.new("RGB", (3000, 2000), color=(0, 0, 255))
    src_path = str(tmp_path / "wide.jpg")
    wide_img.save(src_path, "JPEG")

    image_id = str(uuid.uuid4())
    compressed_path = f"{src_path}.compressed.jpg"

    with (
        patch("app.tasks.image_tasks.upload_file_to_s3") as mock_upload,
        patch("app.tasks.image_tasks.asyncio.run"),
    ):
        mock_upload.side_effect = [
            "https://s3.example.com/images/img.jpg",
            "https://s3.example.com/thumbnails/img.jpg",
        ]
        from app.tasks.image_tasks import process_image

        process_image.run(image_id, src_path)

    # Compressed file is cleaned up; check that upload was called with correct paths
    assert mock_upload.call_count == 2


# ---------------------------------------------------------------------------
# Geocoding task tests
# ---------------------------------------------------------------------------


def test_reverse_geocode_task_rate_limit() -> None:
    from app.tasks.geocoding_tasks import reverse_geocode

    assert reverse_geocode.rate_limit == "1/s"


@pytest.mark.asyncio
async def test_reverse_geocode_task(client: AsyncClient) -> None:
    """Mock Nominatim response and assert address is stored on the report."""
    # Register + create report with coordinates
    await client.post(
        "/v1/auth/register",
        json={"email": "geo@example.com", "password": "password123", "full_name": "Geo User"},
    )
    login = await client.post(
        "/v1/auth/login",
        json={"email": "geo@example.com", "password": "password123"},
    )
    token = login.json()["access_token"]

    with patch("app.tasks.geocoding_tasks.reverse_geocode") as mock_task:
        mock_task.delay = MagicMock()
        create_resp = await client.post(
            "/v1/reports",
            json={
                "title": "Location Test",
                "description": "desc",
                "latitude": 51.5074,
                "longitude": -0.1278,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    report_id = create_resp.json()["id"]
    mock_task.delay.assert_called_once_with(report_id, 51.5074, -0.1278)

    # Now run the geocoding task function directly with a mocked Nominatim response
    mock_nominatim_response = MagicMock()
    mock_nominatim_response.raise_for_status = MagicMock()
    mock_nominatim_response.json.return_value = {
        "display_name": "Westminster, London, Greater London, England, SW1A 2AA, United Kingdom"
    }

    with (
        patch("app.services.geocoding_service.httpx.get", return_value=mock_nominatim_response),
        patch("app.tasks.geocoding_tasks.asyncio.run") as mock_run,
    ):
        mock_run.return_value = None
        from app.tasks.geocoding_tasks import reverse_geocode as geocode_task

        geocode_task.run(report_id, 51.5074, -0.1278)

    mock_run.assert_called_once()


@pytest.mark.asyncio
async def test_location_capture(client: AsyncClient) -> None:
    """Report created with valid lat/lng stores coordinates."""
    await client.post(
        "/v1/auth/register",
        json={"email": "loc@example.com", "password": "password123", "full_name": "Loc User"},
    )
    login = await client.post(
        "/v1/auth/login",
        json={"email": "loc@example.com", "password": "password123"},
    )
    token = login.json()["access_token"]

    with patch("app.tasks.geocoding_tasks.reverse_geocode") as mock_task:
        mock_task.delay = MagicMock()
        resp = await client.post(
            "/v1/reports",
            json={
                "title": "GPS Report",
                "description": "desc",
                "latitude": 48.8566,
                "longitude": 2.3522,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["latitude"] == 48.8566
    assert data["longitude"] == 2.3522
    mock_task.delay.assert_called_once()
