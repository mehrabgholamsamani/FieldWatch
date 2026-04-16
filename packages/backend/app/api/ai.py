import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.report import (
    AIEnhanceRequest,
    AIEnhanceResponse,
    AISuggestPriorityRequest,
    AISuggestPriorityResponse,
)
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/suggest-priority", response_model=AISuggestPriorityResponse)
async def suggest_priority(
    data: AISuggestPriorityRequest,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> AISuggestPriorityResponse:
    result = await asyncio.to_thread(ai_service.suggest_priority, data.title, data.description)
    return AISuggestPriorityResponse(**result)  # type: ignore[arg-type]


@router.post("/enhance-description", response_model=AIEnhanceResponse)
async def enhance_description(
    data: AIEnhanceRequest,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> AIEnhanceResponse:
    enhanced = await asyncio.to_thread(ai_service.enhance_description, data.title, data.description)
    return AIEnhanceResponse(enhanced_description=enhanced)
