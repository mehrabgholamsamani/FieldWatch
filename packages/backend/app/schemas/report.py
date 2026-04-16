import math
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.report import Priority, ReportStatus


# ── AI schemas ────────────────────────────────────────────────────────────────

class AISuggestPriorityRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    description: str = Field(..., min_length=10, max_length=5000)


class AISuggestPriorityResponse(BaseModel):
    priority: Priority
    confidence: float
    reasoning: str


class AIEnhanceRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=10, max_length=5000)


class AIEnhanceResponse(BaseModel):
    enhanced_description: str


class AISuggestNoteResponse(BaseModel):
    suggestion: str


class SimilarReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: ReportStatus
    priority: Priority
    created_at: datetime


class SimilarReportsResponse(BaseModel):
    items: list[SimilarReportItem]


class ReportImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    report_id: uuid.UUID
    original_url: str
    thumbnail_url: str | None
    uploaded_at: datetime


class ReportCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1, max_length=5000)
    priority: Priority = Priority.MEDIUM
    latitude: float | None = None
    longitude: float | None = None
    idempotency_key: str | None = None

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if math.isnan(v) or math.isinf(v):
            raise ValueError("latitude must be a finite number")
        if not -90.0 <= v <= 90.0:
            raise ValueError("latitude must be between -90 and 90")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if math.isnan(v) or math.isinf(v):
            raise ValueError("longitude must be a finite number")
        if not -180.0 <= v <= 180.0:
            raise ValueError("longitude must be between -180 and 180")
        return v


# Reporters can only edit content fields on their own reports
class ReportUpdateReporter(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = Field(None, min_length=1, max_length=5000)
    priority: Priority | None = None


# Managers/admins can additionally change status, assignment, and add a note
class ReportUpdate(ReportUpdateReporter):
    status: ReportStatus | None = None
    assigned_to_id: uuid.UUID | None = None
    manager_note: str | None = Field(None, max_length=5000)


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    status: ReportStatus
    priority: Priority
    latitude: float | None
    longitude: float | None
    address: str | None
    manager_note: str | None
    ai_category: str | None = None
    ai_keywords: str | None = None
    reporter_id: uuid.UUID
    assigned_to_id: uuid.UUID | None
    reporter_name: str | None = None
    assignee_name: str | None = None
    created_at: datetime
    updated_at: datetime
    images: list[ReportImageResponse]


class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    next_cursor: str | None
    total: int


class ReportStatsResponse(BaseModel):
    total: int
    pending_review: int
    resolved_today: int
