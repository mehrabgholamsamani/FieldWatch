import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/auth/register",
        json={"email": "test@example.com", "password": "password123", "full_name": "Test User"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "hashed_password" not in data
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient) -> None:
    payload = {
        "email": "dupe@example.com",
        "password": "password123",
        "full_name": "Dupe User",
    }
    await client.post("/v1/auth/register", json=payload)
    response = await client.post("/v1/auth/register", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login(client: AsyncClient) -> None:
    await client.post(
        "/v1/auth/register",
        json={"email": "login@example.com", "password": "password123", "full_name": "Login User"},
    )
    response = await client.post(
        "/v1/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post(
        "/v1/auth/register",
        json={"email": "wrong@example.com", "password": "password123", "full_name": "Wrong User"},
    )
    response = await client.post(
        "/v1/auth/login",
        json={"email": "wrong@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_without_token(client: AsyncClient) -> None:
    response = await client.get("/v1/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_with_token(client: AsyncClient) -> None:
    await client.post(
        "/v1/auth/register",
        json={
            "email": "protected@example.com",
            "password": "password123",
            "full_name": "Protected User",
        },
    )
    login_resp = await client.post(
        "/v1/auth/login",
        json={"email": "protected@example.com", "password": "password123"},
    )
    token = login_resp.json()["access_token"]
    response = await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "protected@example.com"


@pytest.mark.asyncio
async def test_refresh(client: AsyncClient) -> None:
    await client.post(
        "/v1/auth/register",
        json={
            "email": "refresh@example.com",
            "password": "password123",
            "full_name": "Refresh User",
        },
    )
    login_resp = await client.post(
        "/v1/auth/login",
        json={"email": "refresh@example.com", "password": "password123"},
    )
    refresh_token = login_resp.json()["refresh_token"]
    response = await client.post("/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()
