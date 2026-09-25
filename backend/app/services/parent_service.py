import uuid
import calendar
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from fastapi import HTTPException, status
from app.models.parent import ParentProfile
from app.models.invite import FamilyInvite
from app.models.task import CareTask, TaskInstance
from app.schemas.parent import ParentCreate, ParentUpdate, ParentOut, ParentAdherenceDay, TaskDayDetail
from app.services.invite_service import invite_service
from app.utils.datetime_utils import format_relative_time, get_today_range, format_datetime_time_12h

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
        today_start, today_end = get_today_range()

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

    def get_adherence(
        self,
        db: Session,
        parent_id: Any,
        range_type: str = "week",
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> List[ParentAdherenceDay]:
        # Gracefully handle string or invalid UUID
        valid_parent_id: Optional[uuid.UUID] = None
        if isinstance(parent_id, uuid.UUID):
            valid_parent_id = parent_id
        else:
            try:
                valid_parent_id = uuid.UUID(str(parent_id))
            except (ValueError, TypeError):
                valid_parent_id = None

        local_now = datetime.now().astimezone()
        local_today = local_now.date()

        target_dates: List[date] = []
        if range_type == "month":
            sel_year = year or local_today.year
            sel_month = month or local_today.month
            _, num_days = calendar.monthrange(sel_year, sel_month)
            for d in range(1, num_days + 1):
                target_dates.append(date(sel_year, sel_month, d))
        else:
            # 7 days ending today
            for i in range(7):
                target_dates.append(local_today - timedelta(days=6 - i))

        results: List[ParentAdherenceDay] = []
        for target_date in target_dates:
            day_start = datetime(
                target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=local_now.tzinfo
            ).astimezone(timezone.utc)
            day_end = day_start + timedelta(days=1)

            if valid_parent_id:
                instances = db.scalars(
                    select(TaskInstance).where(
                        TaskInstance.parent_profile_id == valid_parent_id,
                        TaskInstance.scheduled_for >= day_start,
                        TaskInstance.scheduled_for < day_end,
                    ).order_by(TaskInstance.scheduled_for.asc())
                ).all()
            else:
                instances = []

            tasks_list: List[TaskDayDetail] = []
            for inst in instances:
                t = inst.task
                title = t.title if t else "Care Task"
                category = t.category if t else "Wellness"
                sched_time = t.scheduled_time if t else format_datetime_time_12h(inst.scheduled_for)
                comp_time = format_datetime_time_12h(inst.completed_at) if inst.completed_at else None
                tasks_list.append(
                    TaskDayDetail(
                        task_id=str(inst.task_id),
                        instance_id=str(inst.id),
                        title=title,
                        category=category,
                        status=inst.status,
                        scheduled_time=sched_time,
                        completed_time=comp_time,
                    )
                )

            total_tasks = len(instances)
            completed_tasks = sum(1 for x in instances if x.status == "completed")
            rate = int(round((completed_tasks / total_tasks) * 100)) if total_tasks > 0 else 0

            if range_type == "month":
                day_label = f"{target_date.day} {target_date.strftime('%b')}"
            else:
                day_label = target_date.strftime("%a")

            results.append(
                ParentAdherenceDay(
                    day=day_label,
                    rate=rate,
                    date=target_date.isoformat(),
                    day_number=target_date.day,
                    has_tasks=(total_tasks > 0),
                    total_tasks=total_tasks,
                    completed_tasks=completed_tasks,
                    tasks=tasks_list,
                )
            )

        return results

    def get_weekly_adherence(self, db: Session, parent_id: uuid.UUID) -> List[ParentAdherenceDay]:
        return self.get_adherence(db, parent_id, range_type="week")

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
