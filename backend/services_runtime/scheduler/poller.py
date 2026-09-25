import uuid
import logging
from datetime import timedelta
from typing import List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.task import TaskInstance, CareTask
from app.models.parent import ParentProfile
from app.models.notification import Notification
from app.utils.datetime_utils import utcnow
from services_runtime.delivery.base import PushPayload
from services_runtime.delivery.dispatcher import dispatcher

logger = logging.getLogger(__name__)

# In-memory deduplication cache for reminder dispatches within the running process
# Key: f"{instance_id}_{date_str}"
_sent_reminders_cache: Set[str] = set()

async def poll_and_dispatch_reminders(
    db: Session,
    force_instance_id: Optional[uuid.UUID] = None,
) -> List[uuid.UUID]:
    """
    Checks for pending task instances due within the current minute window.
    Dispatches Expo push reminders to assigned parents and records notifications.
    """
    now = utcnow()
    dispatched_ids: List[uuid.UUID] = []

    if force_instance_id:
        query = select(TaskInstance).where(TaskInstance.id == force_instance_id)
    else:
        # Window: tasks scheduled within 5 minutes ago up to 1 minute ahead that are pending
        lower_bound = now - timedelta(minutes=5)
        upper_bound = now + timedelta(minutes=1)
        query = select(TaskInstance).where(
            TaskInstance.status == "pending",
            TaskInstance.scheduled_for >= lower_bound,
            TaskInstance.scheduled_for <= upper_bound,
        )

    instances = db.scalars(query).all()

    for inst in instances:
        task: CareTask = inst.task
        parent: ParentProfile = inst.parent_profile
        if not task or not parent:
            continue

        cache_key = f"{inst.id}_{now.strftime('%Y-%m-%d')}"
        if not force_instance_id and cache_key in _sent_reminders_cache:
            continue

        # Check if already notified in database
        existing_notif = db.scalar(
            select(Notification).where(
                Notification.parent_profile_id == parent.id,
                Notification.notification_type == "reminder",
                Notification.title.ilike(f"%{task.title}%"),
                Notification.created_at >= now - timedelta(hours=12),
            )
        )
        if existing_notif and not force_instance_id:
            _sent_reminders_cache.add(cache_key)
            continue

        # Create Notification record
        title = f"Time for {task.title}"
        body = task.detail or task.notes or f"A gentle reminder for {task.title} at {task.scheduled_time}."
        
        notif = Notification(
            family_id=task.family_id,
            parent_profile_id=parent.id,
            title=title,
            message=body,
            notification_type="reminder",
            is_read=False,
            delivered_at=now,
        )
        db.add(notif)
        db.flush()

        # Build Push Payload
        payload = PushPayload(
            title=title,
            body=body,
            data={
                "type": "care_task_reminder",
                "task_instance_id": str(inst.id),
                "task_id": str(task.id),
                "category": task.category,
                "scheduled_time": task.scheduled_time,
            },
            priority="high",
            sound="default",
        )

        # Dispatch via dispatcher to active parent device tokens
        await dispatcher.dispatch_to_recipient(
            db=db,
            payload=payload,
            notification=notif,
            parent_profile_id=parent.id,
        )

        _sent_reminders_cache.add(cache_key)
        dispatched_ids.append(inst.id)
        logger.info(f"Dispatched reminder for task '{task.title}' to parent '{parent.name}' (instance {inst.id})")

    db.commit()
    return dispatched_ids
