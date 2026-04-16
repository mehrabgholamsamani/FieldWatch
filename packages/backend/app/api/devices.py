from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.device_token import DeviceToken
from app.models.user import User
from app.schemas.device import DeviceRegisterRequest, DeviceRegisterResponse

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post(
    "/register",
    response_model=DeviceRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_device(
    data: DeviceRegisterRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> DeviceRegisterResponse:
    # Upsert: update existing token record if same user+token already registered
    result = await db.execute(
        select(DeviceToken).where(
            DeviceToken.user_id == current_user.id,
            DeviceToken.token == data.token,
        )
    )
    record = result.scalar_one_or_none()

    if record:
        record.platform = data.platform
    else:
        record = DeviceToken(
            user_id=current_user.id,
            token=data.token,
            platform=data.platform,
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return DeviceRegisterResponse.model_validate(record)
