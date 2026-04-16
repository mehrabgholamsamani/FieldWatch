from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.get("", response_model=list[UserResponse])
async def list_users(
    _current_user: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
    role: UserRole | None = Query(default=None),
) -> list[UserResponse]:
    q = select(User)
    if role is not None:
        q = q.where(User.role == role)
    q = q.order_by(User.created_at.desc())
    users = list((await db.execute(q)).scalars().all())
    return [UserResponse.model_validate(u) for u in users]


@router.get("/managers", response_model=list[UserResponse])
async def list_managers(
    _current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> list[UserResponse]:
    """Returns all managers and admins — available to any authenticated user for assignment UI."""
    q = select(User).where(User.role.in_([UserRole.MANAGER, UserRole.ADMIN]))
    q = q.order_by(User.full_name)
    users = list((await db.execute(q)).scalars().all())
    return [UserResponse.model_validate(u) for u in users]
