import uuid
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.parent import ParentProfile
    from app.models.invite import FamilyInvite
    from app.models.task import CareTask
    from app.models.notification import Notification
    from app.models.escalation import Escalation

class Family(Base):
    __tablename__ = "families"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="My Family")
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="owned_families")
    members: Mapped[List["FamilyMember"]] = relationship("FamilyMember", back_populates="family", cascade="all, delete-orphan")
    parents: Mapped[List["ParentProfile"]] = relationship("ParentProfile", back_populates="family", cascade="all, delete-orphan")
    invites: Mapped[List["FamilyInvite"]] = relationship("FamilyInvite", back_populates="family", cascade="all, delete-orphan")
    care_tasks: Mapped[List["CareTask"]] = relationship("CareTask", back_populates="family", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="family", cascade="all, delete-orphan")
    escalations: Mapped[List["Escalation"]] = relationship("Escalation", back_populates="family", cascade="all, delete-orphan")

class FamilyMember(Base):
    __tablename__ = "family_members"
    __table_args__ = (
        UniqueConstraint("family_id", "user_id", name="uq_family_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="child_owner")  # child_owner, child_member, parent
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    family: Mapped["Family"] = relationship("Family", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="family_memberships")
