import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.redis_client import get_redis
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse

_BLOCKLIST_PREFIX = "rt:used:"


async def _is_jti_used(jti: str) -> bool:
    r = get_redis()
    return bool(await r.exists(f"{_BLOCKLIST_PREFIX}{jti}"))


async def _block_jti(jti: str, exp: int) -> None:
    r = get_redis()
    ttl = max(1, exp - int(datetime.now(timezone.utc).timestamp()))
    await r.setex(f"{_BLOCKLIST_PREFIX}{jti}", ttl, "1")


async def register_user(db: AsyncSession, data: RegisterRequest) -> UserResponse:
    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise ConflictError("Email already registered")

    from app.models.user import UserRole

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole(data.role),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


async def login_user(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")

    access_token = create_access_token(user.id, extra={"role": user.role.value})
    refresh_token = create_refresh_token(user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except ValueError as e:
        raise UnauthorizedError(str(e)) from e

    if payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid token type")

    jti = payload.get("jti")
    if not jti:
        raise UnauthorizedError("Invalid token: missing jti")

    # Replay attack prevention: reject already-used JTIs
    if await _is_jti_used(jti):
        raise UnauthorizedError("Refresh token already used")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found")

    # Invalidate the old JTI
    await _block_jti(jti, int(payload["exp"]))

    new_access_token = create_access_token(user.id, extra={"role": user.role.value})
    new_refresh_token = create_refresh_token(user.id)
    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found")
    return user
