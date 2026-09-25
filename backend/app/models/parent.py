import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship as sa_relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.family import Family
    from app.models.user import User
    from app.models.invite import FamilyInvite
    from app.models.task import CareTask, TaskInstance
    from app.models.escalation import Escalation
    from app.models.notification import Notification

class ParentProfile(Base):
    __tablename__ = "parent_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship: Mapped[str] = mapped_column(String(100), nullable=False, default="Parent")
    initials: Mapped[str] = mapped_column(String(10), nullable=False)
    color: Mapped[str] = mapped_column(String(50), nullable=False, default="peach")
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
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
    family: Mapped["Family"] = sa_relationship("Family", back_populates="parents")
    user: Mapped[Optional["User"]] = sa_relationship("User", back_populates="parent_profile")
    invites: Mapped[List["FamilyInvite"]] = sa_relationship("FamilyInvite", back_populates="parent_profile", cascade="all, delete-orphan")
    care_tasks: Mapped[List["CareTask"]] = sa_relationship("CareTask", back_populates="parent_profile", cascade="all, delete-orphan")
    task_instances: Mapped[List["TaskInstance"]] = sa_relationship("TaskInstance", back_populates="parent_profile", cascade="all, delete-orphan")
    escalations: Mapped[List["Escalation"]] = sa_relationship("Escalation", back_populates="parent_profile", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = sa_relationship("Notification", back_populates="parent_profile", cascade="all, delete-orphan")
