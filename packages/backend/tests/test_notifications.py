"""Tests for push notification endpoints and service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_token import DeviceToken
from app.models.user import User, UserRole
from app.core.security import hash_password, create_access_token


# ---------------------------------------------------------------------------
# POST /devices/register
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_device(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    resp = await client.post(
        "/v1/devices/register",
        json={"token": "fcm-token-abc123", "platform": "android"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["token"] == "fcm-token-abc123"
    assert body["platform"] == "android"
    assert "id" in body
    assert "user_id" in body


@pytest.mark.asyncio
async def test_register_device_upsert(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    """Registering the same token again updates platform instead of creating duplicate."""
    payload = {"token": "same-token-xyz", "platform": "android"}
    r1 = await client.post("/v1/devices/register", json=payload, headers=auth_headers)
    assert r1.status_code == 201

    payload2 = {"token": "same-token-xyz", "platform": "ios"}
    r2 = await client.post("/v1/devices/register", json=payload2, headers=auth_headers)
    assert r2.status_code == 201
    assert r2.json()["id"] == r1.json()["id"]  # same record
    assert r2.json()["platform"] == "ios"  # updated


@pytest.mark.asyncio
async def test_register_device_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/v1/devices/register",
        json={"token": "token123", "platform": "ios"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Notification service — unit tests with mocked FCM
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_notification_on_new_report(
    client: AsyncClient,
    auth_headers: dict[str, str],
    manager_token: str,
) -> None:
    """Creating a report triggers notify_new_report for managers."""
    # Register a device token for the manager
    await client.post(
        "/v1/devices/register",
        json={"token": "manager-device-token", "platform": "android"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    sent_messages: list[dict] = []

    def fake_send(message: MagicMock) -> str:  # noqa: ANN001
        sent_messages.append(
            {
                "token": message.token,
                "title": message.notification.title,
                "body": message.notification.body,
            }
        )
        return "msg-id-123"

    mock_messaging = MagicMock()
    mock_messaging.Message = MagicMock(side_effect=lambda **kw: MagicMock(**kw))
    mock_messaging.Notification = MagicMock(side_effect=lambda **kw: MagicMock(**kw))
    mock_messaging.send = fake_send

    with patch(
        "app.services.notification_service._messaging", return_value=mock_messaging
    ):
        resp = await client.post(
            "/v1/reports",
            json={
                "title": "Test Report",
                "description": "Something broke",
                "priority": "HIGH",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 201
    assert len(sent_messages) == 1
    assert sent_messages[0]["token"] == "manager-device-token"
    assert "Test Report" in sent_messages[0]["body"]


@pytest.mark.asyncio
async def test_notification_on_status_change(
    client: AsyncClient,
    auth_headers: dict[str, str],
    manager_token: str,
) -> None:
    """Changing report status triggers notify_status_change for the reporter."""
    # Create a report as reporter
    create_resp = await client.post(
        "/v1/reports",
        json={"title": "Status Change Test", "description": "desc", "priority": "LOW"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    report_id = create_resp.json()["id"]

    # Register reporter device token
    await client.post(
        "/v1/devices/register",
        json={"token": "reporter-device-token", "platform": "ios"},
        headers=auth_headers,
    )

    sent_messages: list[dict] = []

    def fake_send(message: MagicMock) -> str:  # noqa: ANN001
        sent_messages.append(
            {
                "token": message.token,
                "title": message.notification.title,
                "body": message.notification.body,
            }
        )
        return "msg-id-456"

    mock_messaging = MagicMock()
    mock_messaging.Message = MagicMock(side_effect=lambda **kw: MagicMock(**kw))
    mock_messaging.Notification = MagicMock(side_effect=lambda **kw: MagicMock(**kw))
    mock_messaging.send = fake_send

    with patch(
        "app.services.notification_service._messaging", return_value=mock_messaging
    ):
        patch_resp = await client.patch(
            f"/v1/reports/{report_id}",
            json={"status": "IN_REVIEW"},
            headers={"Authorization": f"Bearer {manager_token}"},
        )
    assert patch_resp.status_code == 200
    assert len(sent_messages) == 1
    assert sent_messages[0]["token"] == "reporter-device-token"
    assert "In Review" in sent_messages[0]["body"]


@pytest.mark.asyncio
async def test_no_notification_when_status_unchanged(
    client: AsyncClient,
    auth_headers: dict[str, str],
    manager_token: str,
) -> None:
    """PATCH without status change must not send any notification."""
    create_resp = await client.post(
        "/v1/reports",
        json={"title": "No Notif Test", "description": "desc", "priority": "LOW"},
        headers=auth_headers,
    )
    report_id = create_resp.json()["id"]

    sent_messages: list[dict] = []

    mock_messaging = MagicMock()
    mock_messaging.send = lambda m: sent_messages.append(m) or "id"

    with patch(
        "app.services.notification_service._messaging", return_value=mock_messaging
    ):
        resp = await client.patch(
            f"/v1/reports/{report_id}",
            json={"title": "Updated Title"},
            headers={"Authorization": f"Bearer {manager_token}"},
        )
    assert resp.status_code == 200
    assert len(sent_messages) == 0
