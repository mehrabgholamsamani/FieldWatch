import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class Priority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_reporter_id", "reporter_id"),
        Index("ix_reports_created_at", "created_at"),
        Index("ix_reports_status", "status"),
        Index("ix_reports_lat_lng", "latitude", "longitude"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(String(5000), nullable=False)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus, native_enum=False), nullable=False, default=ReportStatus.DRAFT)
    priority: Mapped[Priority] = mapped_column(Enum(Priority, native_enum=False), nullable=False, default=Priority.MEDIUM)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    manager_note: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    ai_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ai_keywords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(
        String(36), unique=True, nullable=True, index=True
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    reporter: Mapped["User"] = relationship(
        "User", foreign_keys="[Report.reporter_id]", lazy="selectin"
    )
    assignee: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys="[Report.assigned_to_id]", lazy="selectin"
    )
    images: Mapped[list["ReportImage"]] = relationship(
        "ReportImage", back_populates="report", lazy="selectin"
    )

    @property
    def reporter_name(self) -> str | None:
        return self.reporter.full_name if self.reporter else None

    @property
    def assignee_name(self) -> str | None:
        return self.assignee.full_name if self.assignee else None


class ReportImage(Base):
    __tablename__ = "report_images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    original_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    report: Mapped["Report"] = relationship("Report", back_populates="images")
