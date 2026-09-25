import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.family import Family
    from app.models.parent import ParentProfile
    from app.models.task import TaskInstance

class Escalation(Base):
    __tablename__ = "escalations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_instance_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("task_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("parent_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default="Medium")  # Low, Medium, High, Critical
    escalation_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Missed task")  # Missed task, Escalation, Urgent
    action_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="call_parent")  # call_parent, message, check_in
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active", index=True)  # active, acknowledged, resolved, dismissed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    family: Mapped["Family"] = relationship("Family", back_populates="escalations")
    task_instance: Mapped["TaskInstance"] = relationship("TaskInstance", back_populates="escalations")
    parent_profile: Mapped["ParentProfile"] = relationship("ParentProfile", back_populates="escalations")
