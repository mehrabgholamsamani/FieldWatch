import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class DeviceRegisterRequest(BaseModel):
    token: str
    platform: Literal["ios", "android"]


class DeviceRegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    token: str
    platform: str
    created_at: datetime
