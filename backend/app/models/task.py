import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.family import Family
    from app.models.parent import ParentProfile
    from app.models.escalation import Escalation

class TaskParentAssignment(Base):
    __tablename__ = "task_parent_assignments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("care_tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    parent_profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("parent_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )

class CareTask(Base):
    __tablename__ = "care_tasks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_profile_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("parent_profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # Meal, Medicine, Exercise, Appointment, Wellness
    scheduled_time: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "8:30 AM" or "08:30"
    scheduled_end_time: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # e.g. "9:30 AM" or "09:30"
    repeat_pattern: Mapped[str] = mapped_column(String(50), nullable=False, default="Daily")  # Once, Daily, Weekly, Monthly
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    family: Mapped["Family"] = relationship("Family", back_populates="care_tasks")
    parent_profile: Mapped[Optional["ParentProfile"]] = relationship("ParentProfile", back_populates="care_tasks")
    assigned_parents: Mapped[List["ParentProfile"]] = relationship("ParentProfile", secondary="task_parent_assignments", lazy="selectin")
    instances: Mapped[List["TaskInstance"]] = relationship("TaskInstance", back_populates="task", cascade="all, delete-orphan")

class TaskInstance(Base):
    __tablename__ = "task_instances"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("care_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("parent_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)  # pending, completed, missed, snoozed
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    task: Mapped["CareTask"] = relationship("CareTask", back_populates="instances")
    parent_profile: Mapped["ParentProfile"] = relationship("ParentProfile", back_populates="task_instances")
    escalations: Mapped[List["Escalation"]] = relationship("Escalation", back_populates="task_instance", cascade="all, delete-orphan")
