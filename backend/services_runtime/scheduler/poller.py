import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.task import TaskInstance, CareTask
from app.models.parent import ParentProfile
from app.models.family import Family
from app.models.escalation import Escalation
from app.models.notification import Notification
from app.utils.datetime_utils import utcnow, get_today_range, parse_time_string, ensure_utc
from services_runtime.delivery.base import PushPayload
from services_runtime.delivery.dispatcher import dispatcher

def compute_instance_deadline(inst: TaskInstance, task: CareTask) -> datetime:
    """
    Computes deadline when a task expires and must be marked missed:
    - inst.end_time if explicitly set
    - parsed scheduled_end_time from task definition if available
    - scheduled_for + 1 hour if no end time exists
    """
    if inst.end_time:
        return ensure_utc(inst.end_time)
    sched = ensure_utc(inst.scheduled_for)
    if task and task.scheduled_end_time:
        try:
            eh, em = parse_time_string(task.scheduled_end_time)
            deadline = sched.replace(hour=eh, minute=em, second=0, microsecond=0)
            if deadline < sched:
                deadline += timedelta(days=1)
            return ensure_utc(deadline)
        except Exception:
            pass
    return sched + timedelta(hours=1)



logger = logging.getLogger(__name__)

async def poll_and_dispatch_reminders(
    db: Session,
    force_instance_id: Optional[uuid.UUID] = None,
    force_stage: Optional[int] = None,
) -> List[uuid.UUID]:
    """
    Evaluates pending/snoozed task instances across a 4-stage reminder schedule:
      - Stage 0 (T = 0m, task time reached): Initial reminder to parent app (with ringing alarm if urgent toggle ON)
      - Stage 1 (T = +15m overdue): 1st follow-up reminder to parent app
      - Stage 2 (T = +30m overdue): 2nd follow-up reminder to parent app
      - Stage 3 (T = +45m overdue): Escalate to child caregiver to CALL parent directly
    """
    now = utcnow()
    dispatched_ids: List[uuid.UUID] = []
    today_start, _ = get_today_range()

    if force_instance_id:
        query = select(TaskInstance).where(TaskInstance.id == force_instance_id)
    else:
        # Check active instances for today scheduled up to 1 min in future
        query = select(TaskInstance).where(
            TaskInstance.status.in_(["pending", "snoozed"]),
            TaskInstance.scheduled_for >= today_start - timedelta(hours=6),
            TaskInstance.scheduled_for <= now + timedelta(minutes=1),
        )

    instances = db.scalars(query).all()

    for inst in instances:
        task: CareTask = inst.task
        parent: ParentProfile = inst.parent_profile
        if not task or not parent or not task.is_active:
            continue

        sched_for = ensure_utc(inst.scheduled_for)
        snooze_until = ensure_utc(inst.snoozed_until)

        # If snoozed and snooze period hasn't elapsed, wait
        if inst.status == "snoozed" and snooze_until and now < snooze_until and not force_instance_id:
            continue

        stage = force_stage if force_stage is not None else inst.reminder_stage
        deadline = compute_instance_deadline(inst, task)
        is_past_deadline = (now >= deadline)

        # If task time has ended (or 1 hour passed with no end time), mark task as missed
        if (is_past_deadline and not force_instance_id and force_stage is None) or stage == 4:
            if not is_past_deadline and not force_instance_id:
                # Stage 4 reached but task time window has not expired yet -> wait for deadline
                continue

            inst.status = "missed"
            inst.reminder_stage = 5
            inst.last_reminded_at = now

            # Update or create Escalation record as Missed task
            escalation = db.scalar(
                select(Escalation).where(Escalation.task_instance_id == inst.id)
            )
            if escalation:
                escalation.escalation_type = "Missed task"
                escalation.detail = f"{task.title} was not completed within the designated time window and has been marked as missed."
            else:
                escalation = Escalation(
                    family_id=task.family_id,
                    task_instance_id=inst.id,
                    parent_profile_id=parent.id,
                    title=f"❌ {task.title} missed",
                    detail=f"{parent.name} did not complete {task.title} within the allowed window.",
                    priority="High" if (task.category in ("Medicine", "Meal") or task.ring_alarm) else "Medium",
                    escalation_type="Missed task",
                    action_type="call_parent",
                    status="active",
                    created_at=now,
                )
                db.add(escalation)
                db.flush()

            # Push notification to parent informing task window ended
            parent_notif = Notification(
                family_id=task.family_id,
                parent_profile_id=parent.id,
                title=f"❌ Task Ended: {task.title}",
                message=f"The time window for {task.title} has ended and it is now recorded as missed.",
                notification_type="task_missed",
                is_read=False,
                delivered_at=now,
            )
            db.add(parent_notif)
            db.flush()

            parent_payload = PushPayload(
                title=f"❌ Task Ended: {task.title}",
                body=f"The time window for {task.title} has ended and it is now recorded as missed.",
                data={
                    "type": "care_task_missed",
                    "task_instance_id": str(inst.id),
                    "task_id": str(task.id),
                    "task_title": task.title,
                    "stage": 4,
                },
                priority="high",
                sound="default",
            )
            await dispatcher.dispatch_to_recipient(
                db=db,
                payload=parent_payload,
                notification=parent_notif,
                parent_profile_id=parent.id,
            )

            dispatched_ids.append(inst.id)
            logger.info(f"Marked task instance {inst.id} ('{task.title}') as missed (time ended)")
            continue

        # --- Stage 0: At Scheduled Time (T = 0m) ---
        if stage == 0:
            if not force_instance_id and sched_for and now < sched_for:
                continue

            is_alarm = bool(task.ring_alarm)
            title = f"⏰ Alarm: Time for {task.title}!" if is_alarm else f"Time for {task.title}"
            body = task.detail or task.notes or f"Time to complete {task.title} ({task.category})."

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

            payload = PushPayload(
                title=title,
                body=body,
                data={
                    "type": "care_task_reminder",
                    "stage": 0,
                    "stage_name": "initial_due",
                    "ring_alarm": is_alarm,
                    "is_urgent": is_alarm,
                    "task_instance_id": str(inst.id),
                    "task_id": str(task.id),
                    "category": task.category,
                    "task_title": task.title,
                    "scheduled_time": task.scheduled_time,
                    "action": "complete_task",
                },
                priority="high",
                sound="default",
                channel_id="urgent_alarm" if is_alarm else "carecircle-reminders",
            )

            await dispatcher.dispatch_to_recipient(
                db=db,
                payload=payload,
                notification=notif,
                parent_profile_id=parent.id,
            )

            inst.reminder_stage = 1
            inst.last_reminded_at = now
            dispatched_ids.append(inst.id)
            logger.info(f"Dispatched Stage 0 reminder for task '{task.title}' to parent '{parent.name}' (alarm={is_alarm})")

        # --- Stage 1: 15 Mins Overdue (T = +15m) ---
        elif stage == 1:
            threshold_15m = sched_for + timedelta(minutes=15)
            if not force_instance_id and now < threshold_15m:
                continue

            is_alarm = bool(task.ring_alarm)
            title = f"⏰ Alarm Reminder: {task.title} is waiting" if is_alarm else f"Reminder: {task.title} is waiting"
            body = f"{task.title} was scheduled for {task.scheduled_time}. Please complete it when ready."

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

            payload = PushPayload(
                title=title,
                body=body,
                data={
                    "type": "care_task_reminder",
                    "stage": 1,
                    "stage_name": "15m_overdue",
                    "ring_alarm": is_alarm,
                    "is_urgent": is_alarm,
                    "task_instance_id": str(inst.id),
                    "task_id": str(task.id),
                    "category": task.category,
                    "task_title": task.title,
                    "scheduled_time": task.scheduled_time,
                    "action": "complete_task",
                },
                priority="high",
                sound="default",
                channel_id="urgent_alarm" if is_alarm else "carecircle-reminders",
            )

            await dispatcher.dispatch_to_recipient(
                db=db,
                payload=payload,
                notification=notif,
                parent_profile_id=parent.id,
            )

            inst.reminder_stage = 2
            inst.last_reminded_at = now
            dispatched_ids.append(inst.id)
            logger.info(f"Dispatched Stage 1 (15m) reminder for task '{task.title}' to parent '{parent.name}'")

        # --- Stage 2: 30 Mins Overdue (T = +30m) ---
        elif stage == 2:
            threshold_30m = sched_for + timedelta(minutes=30)
            if not force_instance_id and now < threshold_30m:
                continue

            is_alarm = bool(task.ring_alarm)
            title = f"⏰ Urgent Alarm: {task.title} is 30m overdue!" if is_alarm else f"2nd Reminder: {task.title} is overdue"
            body = f"Important: {task.title} is 30 minutes past due. Please complete this task."

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

            payload = PushPayload(
                title=title,
                body=body,
                data={
                    "type": "care_task_reminder",
                    "stage": 2,
                    "stage_name": "30m_overdue",
                    "ring_alarm": is_alarm,
                    "is_urgent": is_alarm,
                    "task_instance_id": str(inst.id),
                    "task_id": str(task.id),
                    "category": task.category,
                    "task_title": task.title,
                    "scheduled_time": task.scheduled_time,
                    "action": "complete_task",
                },
                priority="high",
                sound="default",
                channel_id="urgent_alarm" if is_alarm else "carecircle-reminders",
            )

            await dispatcher.dispatch_to_recipient(
                db=db,
                payload=payload,
                notification=notif,
                parent_profile_id=parent.id,
            )

            inst.reminder_stage = 3
            inst.last_reminded_at = now
            dispatched_ids.append(inst.id)
            logger.info(f"Dispatched Stage 2 (30m) reminder for task '{task.title}' to parent '{parent.name}'")

        # --- Stage 3: 45 Mins Overdue (T = +45m) -> ALARM PARENT AGAIN + ALARM CHILD TO CALL PARENT ---
        elif stage == 3:
            threshold_45m = sched_for + timedelta(minutes=45)
            if not force_instance_id and now < threshold_45m:
                continue

            # Crucial: Task is NOT marked missed here! It remains active so parent can complete it.
            inst.reminder_stage = 4
            inst.last_reminded_at = now

            is_alarm = bool(task.ring_alarm)
            priority = "High" if (task.category in ("Medicine", "Meal") or is_alarm) else "Medium"
            esc_title = f"🚨 Call {parent.name} Alarm: {task.title} overdue"
            esc_detail = f"{parent.name} has not completed {task.title} after 45 minutes (scheduled for {task.scheduled_time}). Please call them directly!"

            # 1. Alarm Parent for task again
            parent_title = f"⏰ Urgent Alarm: {task.title} is 45m overdue!" if is_alarm else f"⏰ Reminder: {task.title} is 45m overdue!"
            parent_body = f"Please complete {task.title} now! Your family caregiver has also received an alarm to call you."

            parent_notif = Notification(
                family_id=task.family_id,
                parent_profile_id=parent.id,
                title=parent_title,
                message=parent_body,
                notification_type="reminder",
                is_read=False,
                delivered_at=now,
            )
            db.add(parent_notif)
            db.flush()

            parent_payload = PushPayload(
                title=parent_title,
                body=parent_body,
                data={
                    "type": "care_task_reminder",
                    "stage": 3,
                    "stage_name": "45m_overdue",
                    "ring_alarm": is_alarm,
                    "is_urgent": is_alarm,
                    "task_instance_id": str(inst.id),
                    "task_id": str(task.id),
                    "category": task.category,
                    "task_title": task.title,
                    "scheduled_time": task.scheduled_time,
                    "action": "complete_task",
                },
                priority="high",
                sound="default",
                channel_id="urgent_alarm" if is_alarm else "carecircle-reminders",
            )
            await dispatcher.dispatch_to_recipient(
                db=db,
                payload=parent_payload,
                notification=parent_notif,
                parent_profile_id=parent.id,
            )

            # 2. At the same time, child will have an alarm for calling parent
            escalation = db.scalar(
                select(Escalation).where(Escalation.task_instance_id == inst.id)
            )
            if not escalation:
                escalation = Escalation(
                    family_id=task.family_id,
                    task_instance_id=inst.id,
                    parent_profile_id=parent.id,
                    title=esc_title,
                    detail=esc_detail,
                    priority=priority,
                    escalation_type="Overdue task",
                    action_type="call_parent",
                    status="active",
                    created_at=now,
                )
                db.add(escalation)
                db.flush()

            family: Family = parent.family
            if family and family.owner_id:
                child_notif = Notification(
                    family_id=task.family_id,
                    recipient_user_id=family.owner_id,
                    parent_profile_id=parent.id,
                    title=f"🚨 Call {parent.name} Alarm: {task.title} overdue!",
                    message=esc_detail,
                    notification_type="escalation",
                    is_read=False,
                    delivered_at=now,
                )
                db.add(child_notif)
                db.flush()

                child_push = PushPayload(
                    title=f"🚨 Call {parent.name} Alarm: {task.title} overdue!",
                    body=f"{parent.name} has not completed {task.title} after 45 minutes. Ringing alarm to call them now!",
                    data={
                        "type": "care_task_escalation",
                        "action": "call_parent",
                        "ring_alarm": True,
                        "is_urgent": True,
                        "parent_id": str(parent.id),
                        "parent_name": parent.name,
                        "parent_phone": parent.phone or "",
                        "task_instance_id": str(inst.id),
                        "task_id": str(task.id),
                        "task_title": task.title,
                        "priority": "High",
                        "stage": 3,
                    },
                    priority="high",
                    sound="default",
                    channel_id="urgent_alarm",
                )

                await dispatcher.dispatch_to_recipient(
                    db=db,
                    payload=child_push,
                    notification=child_notif,
                    user_id=family.owner_id,
                )

            dispatched_ids.append(inst.id)
            logger.warning(f"Dispatched Stage 3 (45m): alarmed parent again and alarmed child to call {parent.name} for task '{task.title}'")

    db.commit()
    return dispatched_ids

