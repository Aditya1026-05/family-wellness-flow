import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from fastapi import HTTPException, status
from app.models.parent import ParentProfile
from app.models.invite import FamilyInvite
from app.models.task import CareTask, TaskInstance
from app.schemas.parent import ParentCreate, ParentUpdate, ParentOut, ParentAdherenceDay
from app.services.invite_service import invite_service
from app.utils.datetime_utils import format_relative_time

class ParentService:
    def create_parent(
        self,
        db: Session,
        family_id: uuid.UUID,
        user_id: uuid.UUID,
        parent_in: ParentCreate,
    ) -> Tuple[ParentProfile, FamilyInvite]:
        # Generate initials
        parts = [p for p in parent_in.name.strip().split() if p]
        initials = "".join(p[0] for p in parts[:2]).upper() if parts else "P"

        parent = ParentProfile(
            family_id=family_id,
            name=parent_in.name.strip(),
            relationship=parent_in.relationship.strip() or "Parent",
            initials=initials,
            color=parent_in.color or "peach",
            avatar_url=parent_in.avatar_url,
        )
        db.add(parent)
        db.commit()
        db.refresh(parent)

        # Generate QR invite token
        invite = invite_service.create_invite_for_parent(
            db=db,
            parent_profile_id=parent.id,
            created_by_user_id=user_id,
        )

        return parent, invite

    def _compute_parent_stats(self, db: Session, parent: ParentProfile) -> Tuple[int, str]:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        # Query today's instances
        instances = db.scalars(
            select(TaskInstance).where(
                TaskInstance.parent_profile_id == parent.id,
                TaskInstance.scheduled_for >= today_start,
                TaskInstance.scheduled_for < today_end,
            )
        ).all()

        if instances:
            completed_count = sum(1 for inst in instances if inst.status == "completed")
            completion = int(round((completed_count / len(instances)) * 100))
        else:
            completion = 100

        # Last activity
        last_instance = db.scalar(
            select(TaskInstance).where(
                TaskInstance.parent_profile_id == parent.id,
                TaskInstance.status == "completed",
            ).order_by(TaskInstance.completed_at.desc()).limit(1)
        )

        if last_instance and last_instance.completed_at:
            last_activity = format_relative_time(last_instance.completed_at)
        elif parent.user_id:
            last_activity = "Joined family"
        else:
            last_activity = "Invite pending"

        return completion, last_activity

    def list_parents(self, db: Session, family_id: uuid.UUID) -> List[ParentOut]:
        parents = db.scalars(
            select(ParentProfile).where(ParentProfile.family_id == family_id).order_by(ParentProfile.created_at.asc())
        ).all()

        results: List[ParentOut] = []
        for p in parents:
            completion, last_activity = self._compute_parent_stats(db, p)
            results.append(
                ParentOut(
                    id=str(p.id),
                    family_id=str(p.family_id),
                    user_id=str(p.user_id) if p.user_id else None,
                    name=p.name,
                    relationship=p.relationship,
                    initials=p.initials,
                    color=p.color,
                    avatar_url=p.avatar_url,
                    lastActivity=last_activity,
                    completion=completion,
                    created_at=p.created_at,
                )
            )
        return results

    def get_parent_by_id(self, db: Session, parent_id: uuid.UUID) -> ParentOut:
        p = db.get(ParentProfile, parent_id)
        if not p:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found.")

        completion, last_activity = self._compute_parent_stats(db, p)
        return ParentOut(
            id=str(p.id),
            family_id=str(p.family_id),
            user_id=str(p.user_id) if p.user_id else None,
            name=p.name,
            relationship=p.relationship,
            initials=p.initials,
            color=p.color,
            avatar_url=p.avatar_url,
            lastActivity=last_activity,
            completion=completion,
            created_at=p.created_at,
        )

    def get_weekly_adherence(self, db: Session, parent_id: uuid.UUID) -> List[ParentAdherenceDay]:
        # Return 7-day adherence: Mon-Sun
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        now = datetime.now(timezone.utc)
        current_weekday = now.weekday()  # Mon is 0

        # Query instances for the last 7 days
        results: List[ParentAdherenceDay] = []
        for i in range(7):
            day_offset = (current_weekday - (6 - i)) % 7
            day_name = days[day_offset]

            day_start = (now - timedelta(days=6 - i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)

            instances = db.scalars(
                select(TaskInstance).where(
                    TaskInstance.parent_profile_id == parent_id,
                    TaskInstance.scheduled_for >= day_start,
                    TaskInstance.scheduled_for < day_end,
                )
            ).all()

            if instances:
                rate = int(round((sum(1 for x in instances if x.status == "completed") / len(instances)) * 100))
            else:
                rate = 0

            results.append(ParentAdherenceDay(day=day_name, rate=rate))

        return results

    def update_parent(
        self,
        db: Session,
        parent_id: uuid.UUID,
        family_id: uuid.UUID,
        parent_in: ParentUpdate,
    ) -> ParentOut:
        p = db.get(ParentProfile, parent_id)
        if not p or p.family_id != family_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found.")

        if parent_in.name is not None and parent_in.name.strip():
            p.name = parent_in.name.strip()
            parts = [part for part in p.name.split() if part]
            p.initials = "".join(part[0] for part in parts[:2]).upper() if parts else "P"

        if parent_in.relationship is not None and parent_in.relationship.strip():
            p.relationship = parent_in.relationship.strip()

        if parent_in.color is not None:
            p.color = parent_in.color

        if parent_in.avatar_url is not None:
            p.avatar_url = parent_in.avatar_url

        db.commit()
        db.refresh(p)
        completion, last_activity = self._compute_parent_stats(db, p)
        return ParentOut(
            id=str(p.id),
            family_id=str(p.family_id),
            user_id=str(p.user_id) if p.user_id else None,
            name=p.name,
            relationship=p.relationship,
            initials=p.initials,
            color=p.color,
            avatar_url=p.avatar_url,
            lastActivity=last_activity,
            completion=completion,
            created_at=p.created_at,
        )

    def delete_parent(self, db: Session, parent_id: uuid.UUID, family_id: uuid.UUID) -> bool:
        p = db.get(ParentProfile, parent_id)
        if not p or p.family_id != family_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found.")
        db.delete(p)
        db.commit()
        return True

parent_service = ParentService()
