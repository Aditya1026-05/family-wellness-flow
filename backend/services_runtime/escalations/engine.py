import uuid
import logging
from datetime import timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.task import TaskInstance, CareTask
from app.models.parent import ParentProfile
from app.models.family import Family
from app.models.escalation import Escalation
from app.models.notification import Notification
from app.utils.datetime_utils import utcnow
from services_runtime.config import runtime_config
from services_runtime.delivery.base import PushPayload
from services_runtime.delivery.dispatcher import dispatcher

logger = logging.getLogger(__name__)

async def evaluate_and_escalate_overdue_tasks(
    db: Session,
    force_instance_id: Optional[uuid.UUID] = None,
) -> List[uuid.UUID]:
    """
    Evaluates pending/snoozed task instances against task-level escalation thresholds.
    When a task is past its end-time + threshold window, marks it missed,
    creates an Escalation record, and dispatches high-priority push alerts to child caregivers.
    """
    now = utcnow()
    escalated_ids: List[uuid.UUID] = []

    if force_instance_id:
        query = select(TaskInstance).where(TaskInstance.id == force_instance_id)
    else:
        query = select(TaskInstance).where(
            TaskInstance.status.in_(["pending", "snoozed"])
        )

    instances = db.scalars(query).all()

    for inst in instances:
        task: CareTask = inst.task
        parent: ParentProfile = inst.parent_profile
        if not task or not parent:
            continue

        family: Family = parent.family
        threshold_minutes = task.escalation_threshold_minutes or runtime_config.DEFAULT_ESCALATION_THRESHOLD_MINUTES

        # Determine reference deadline
        deadline = inst.end_time or inst.scheduled_for
        overdue_threshold = deadline + timedelta(minutes=threshold_minutes)

        is_overdue = force_instance_id is not None or (now >= overdue_threshold)

        if not is_overdue:
            continue

        # Check if already escalated
        existing_esc = db.scalar(
            select(Escalation).where(Escalation.task_instance_id == inst.id)
        )
        if existing_esc and not force_instance_id:
            continue

        # Transition task instance status to missed
        inst.status = "missed"
        inst.reminder_stage = 4
        inst.last_reminded_at = now

        priority = "High" if (task.category in ("Medicine", "Meal") or task.ring_alarm) else "Medium"
        title = f"⚠️ Call {parent.name}: {task.title} missed"
        detail = f"{parent.name} has not completed {task.title} after 45 minutes (scheduled {task.scheduled_time}). Please call them directly to check in!"

        if not existing_esc:
            escalation = Escalation(
                family_id=task.family_id,
                task_instance_id=inst.id,
                parent_profile_id=parent.id,
                title=title,
                detail=detail,
                priority=priority,
                escalation_type="Missed task",
                action_type="call_parent",
                status="active",
                created_at=now,
            )
            db.add(escalation)
            db.flush()

        # Notify family owner (child caregiver)
        if family and family.owner_id:
            notif = Notification(
                family_id=task.family_id,
                recipient_user_id=family.owner_id,
                parent_profile_id=parent.id,
                title=title,
                message=detail,
                notification_type="escalation",
                is_read=False,
                delivered_at=now,
            )
            db.add(notif)
            db.flush()

            push_payload = PushPayload(
                title=title,
                body=detail,
                data={
                    "type": "care_task_escalation",
                    "action": "call_parent",
                    "task_instance_id": str(inst.id),
                    "parent_id": str(parent.id),
                    "parent_name": parent.name,
                    "parent_phone": parent.phone or "",
                    "task_id": str(task.id),
                    "task_title": task.title,
                    "priority": priority,
                },
                priority="high",
                sound="default",
            )

            await dispatcher.dispatch_to_recipient(
                db=db,
                payload=push_payload,
                notification=notif,
                user_id=family.owner_id,
            )

        escalated_ids.append(inst.id)
        logger.warning(f"Escalated missed task '{task.title}' for {parent.name} (instance {inst.id}) to call caregiver")

    db.commit()
    return escalated_ids
