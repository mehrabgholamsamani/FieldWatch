import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password
from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestAsyncSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db() -> AsyncSession:  # type: ignore[misc]
    async with TestAsyncSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
async def setup_db() -> None:  # type: ignore[misc]
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Reset rate-limit counters so tests don't interfere with each other
    limiter._storage.reset()
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client() -> AsyncClient:  # type: ignore[misc]
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:  # type: ignore[misc]
    """Register a reporter user and return Authorization headers."""
    resp = await client.post(
        "/v1/auth/register",
        json={"email": "reporter@test.com", "password": "password123", "full_name": "Test Reporter"},
    )
    assert resp.status_code == 201, resp.text
    token_resp = await client.post(
        "/v1/auth/login",
        json={"email": "reporter@test.com", "password": "password123"},
    )
    access_token = token_resp.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
async def manager_token(client: AsyncClient) -> str:  # type: ignore[misc]
    async with TestAsyncSessionLocal() as db:
        manager = User(
            email="manager@test.com",
            hashed_password=hash_password("password123"),
            full_name="Test Manager",
            role=UserRole.MANAGER,
        )
        db.add(manager)
        await db.commit()
        await db.refresh(manager)
        token = create_access_token(manager.id, extra={"role": manager.role.value})
    return token
