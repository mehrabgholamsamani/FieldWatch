import pytest
from httpx import AsyncClient


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


@pytest.mark.asyncio
async def test_create_report(client: AsyncClient) -> None:
    token = await _register_login(client, "rep@example.com")
    resp = await client.post(
        "/v1/reports",
        json={"title": "Broken Pipe", "description": "Pipe burst at junction", "priority": "HIGH"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Broken Pipe"
    assert data["status"] == "DRAFT"
    assert data["priority"] == "HIGH"
    assert "reporter_id" in data
    assert data["images"] == []


@pytest.mark.asyncio
async def test_create_report_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/v1/reports",
        json={"title": "Test", "description": "desc"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_reports_reporter_sees_only_own(client: AsyncClient) -> None:
    token1 = await _register_login(client, "rep1@example.com")
    token2 = await _register_login(client, "rep2@example.com")

    await client.post(
        "/v1/reports",
        json={"title": "Rep1 Report", "description": "desc"},
        headers={"Authorization": f"Bearer {token1}"},
    )
    await client.post(
        "/v1/reports",
        json={"title": "Rep2 Report", "description": "desc"},
        headers={"Authorization": f"Bearer {token2}"},
    )

    resp = await client.get("/v1/reports", headers={"Authorization": f"Bearer {token1}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Rep1 Report"


@pytest.mark.asyncio
async def test_list_reports_manager_sees_all(
    client: AsyncClient, manager_token: str
) -> None:
    token1 = await _register_login(client, "rep1@example.com")
    token2 = await _register_login(client, "rep2@example.com")

    for t, title in [(token1, "Report A"), (token2, "Report B")]:
        await client.post(
            "/v1/reports",
            json={"title": title, "description": "desc"},
            headers={"Authorization": f"Bearer {t}"},
        )

    resp = await client.get("/v1/reports", headers={"Authorization": f"Bearer {manager_token}"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_get_report(client: AsyncClient) -> None:
    token = await _register_login(client, "rep@example.com")
    create_resp = await client.post(
        "/v1/reports",
        json={"title": "Inspect Gate", "description": "Gate needs inspection"},
        headers={"Authorization": f"Bearer {token}"},
    )
    report_id = create_resp.json()["id"]

    resp = await client.get(
        f"/v1/reports/{report_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == report_id
    assert data["images"] == []


@pytest.mark.asyncio
async def test_get_report_other_reporter_forbidden(client: AsyncClient) -> None:
    token1 = await _register_login(client, "rep1@example.com")
    token2 = await _register_login(client, "rep2@example.com")

    create_resp = await client.post(
        "/v1/reports",
        json={"title": "Private Report", "description": "desc"},
        headers={"Authorization": f"Bearer {token1}"},
    )
    report_id = create_resp.json()["id"]

    resp = await client.get(
        f"/v1/reports/{report_id}", headers={"Authorization": f"Bearer {token2}"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_report_status_as_manager(
    client: AsyncClient, manager_token: str
) -> None:
    """Managers can change report status."""
    token = await _register_login(client, "rep@example.com")
    create_resp = await client.post(
        "/v1/reports",
        json={"title": "Leaking Roof", "description": "desc"},
        headers={"Authorization": f"Bearer {token}"},
    )
    report_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/v1/reports/{report_id}",
        json={"status": "IN_REVIEW"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "IN_REVIEW"


@pytest.mark.asyncio
async def test_reporter_cannot_change_status(client: AsyncClient) -> None:
    """Reporters cannot change report status — field is silently ignored."""
    token = await _register_login(client, "rep@example.com")
    create_resp = await client.post(
        "/v1/reports",
        json={"title": "Leaking Roof", "description": "desc"},
        headers={"Authorization": f"Bearer {token}"},
    )
    report_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/v1/reports/{report_id}",
        json={"status": "RESOLVED"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    # Status must remain DRAFT — reporter cannot elevate it
    assert resp.json()["status"] == "DRAFT"


@pytest.mark.asyncio
async def test_nearby_reports(client: AsyncClient) -> None:
    token = await _register_login(client, "rep@example.com")

    # Report at origin (0, 0)
    await client.post(
        "/v1/reports",
        json={"title": "Near Report", "description": "desc", "latitude": 0.0, "longitude": 0.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Report far away
    await client.post(
        "/v1/reports",
        json={
            "title": "Far Report",
            "description": "desc",
            "latitude": 10.0,
            "longitude": 10.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/v1/reports/nearby?lat=0.0&lng=0.0&radius=1000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    titles = [r["title"] for r in resp.json()]
    assert "Near Report" in titles
    assert "Far Report" not in titles


@pytest.mark.asyncio
async def test_pagination(client: AsyncClient) -> None:
    token = await _register_login(client, "rep@example.com")

    for i in range(25):
        await client.post(
            "/v1/reports",
            json={"title": f"Report {i}", "description": "desc"},
            headers={"Authorization": f"Bearer {token}"},
        )

    resp = await client.get(
        "/v1/reports?page_size=10", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 25
    assert len(data["items"]) == 10
    assert data["next_cursor"] is not None

    # Fetch next page using cursor
    cursor = data["next_cursor"]
    resp2 = await client.get(
        f"/v1/reports?page_size=10&cursor={cursor}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["items"]) == 10
    # No overlap between pages
    ids1 = {r["id"] for r in data["items"]}
    ids2 = {r["id"] for r in data2["items"]}
    assert ids1.isdisjoint(ids2)


@pytest.mark.asyncio
async def test_idempotency(client: AsyncClient) -> None:
    token = await _register_login(client, "rep@example.com")
    key = "unique-idempotency-key-abc123"

    resp1 = await client.post(
        "/v1/reports",
        json={"title": "First Submit", "description": "desc", "idempotency_key": key},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp1.status_code == 201
    report_id = resp1.json()["id"]

    # Second submission with same key returns the original report (not a new one)
    resp2 = await client.post(
        "/v1/reports",
        json={"title": "Duplicate Submit", "description": "desc2", "idempotency_key": key},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 201
    assert resp2.json()["id"] == report_id
    assert resp2.json()["title"] == "First Submit"

    # Only one report exists in the DB
    list_resp = await client.get("/v1/reports", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.json()["total"] == 1
