import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.models.escalation import Escalation
from app.models.task import TaskInstance, CareTask
from app.models.parent import ParentProfile
from app.models.family import Family
from app.schemas.escalation import AlertOut
from app.utils.datetime_utils import format_relative_time, utcnow, get_today_range
from app.services.notification_service import notification_service

class EscalationService:
    def check_overdue_and_escalate(
        self,
        db: Session,
        family_id: Optional[uuid.UUID] = None,
        grace_period_minutes: int = 30,
    ) -> List[Escalation]:
        """
        Scans for pending task instances past their scheduled window
        and creates escalation records and child notifications.
        """
        now = utcnow()
        threshold = now - timedelta(minutes=grace_period_minutes)

        query = select(TaskInstance).where(
            TaskInstance.status.in_(["pending", "snoozed"]),
            TaskInstance.scheduled_for <= threshold,
        )

        instances = db.scalars(query).all()
        created_escalations: List[Escalation] = []

        for inst in instances:
            task = inst.task
            parent = inst.parent_profile
            if not task or not parent:
                continue

            if family_id and task.family_id != family_id:
                continue

            # Check if escalation already created for this instance
            existing = db.scalar(
                select(Escalation).where(
                    Escalation.task_instance_id == inst.id,
                )
            )

            if not existing:
                # Mark instance status as missed if well past due
                inst.status = "missed"

                priority = "High" if task.category in ("Medicine", "Meal") else "Medium"
                title = f"{parent.relationship or 'Parent'} missed {task.title}"
                detail = f"{parent.name} has not confirmed their {task.scheduled_time} {task.title}."

                escalation = Escalation(
                    family_id=task.family_id,
                    task_instance_id=inst.id,
                    parent_profile_id=parent.id,
                    title=title,
                    detail=detail,
                    priority=priority,
                    escalation_type="Missed task",
                    status="active",
                )
                db.add(escalation)
                created_escalations.append(escalation)

                # Send notification to family child owner
                family = parent.family
                notification_service.create_notification(
                    db=db,
                    family_id=task.family_id,
                    title=title,
                    message=detail,
                    notification_type="escalation",
                    recipient_user_id=family.owner_id if family else None,
                    parent_profile_id=parent.id,
                )

        if created_escalations:
            db.commit()

        return created_escalations

    def list_alerts(self, db: Session, family_id: uuid.UUID, today_only: bool = False) -> List[AlertOut]:
        # Run auto-escalation check to ensure fresh state
        self.check_overdue_and_escalate(db, family_id=family_id)

        today_start, today_end = get_today_range()
        conditions = [
            Escalation.family_id == family_id,
            Escalation.status == "active",
        ]
        if today_only:
            conditions.append(Escalation.created_at >= today_start)

        escalations = db.scalars(
            select(Escalation).where(*conditions).order_by(Escalation.created_at.desc())
        ).all()

        results: List[AlertOut] = []
        for e in escalations:
            time_str = format_relative_time(e.created_at)
            p_name = e.parent_profile.name if e.parent_profile else None
            p_phone = e.parent_profile.phone if e.parent_profile else None
            results.append(
                AlertOut(
                    id=str(e.id),
                    family_id=str(e.family_id),
                    task_instance_id=str(e.task_instance_id),
                    parent_profile_id=str(e.parent_profile_id),
                    parent_name=p_name,
                    parentName=p_name,
                    parent_phone=p_phone,
                    parentPhone=p_phone,
                    title=e.title,
                    detail=e.detail,
                    priority=e.priority,  # type: ignore
                    type=e.escalation_type,  # type: ignore
                    action_type=e.action_type or "call_parent",
                    actionType=e.action_type or "call_parent",
                    status=e.status,  # type: ignore
                    time=time_str,
                    created_at=e.created_at,
                    resolved_at=e.resolved_at,
                )
            )
        return results

    def dismiss_alert(self, db: Session, alert_id: uuid.UUID, family_id: uuid.UUID) -> bool:
        alert = db.get(Escalation, alert_id)
        if not alert or alert.family_id != family_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")

        alert.status = "dismissed"
        alert.resolved_at = utcnow()
        db.commit()
        return True

escalation_service = EscalationService()
