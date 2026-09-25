import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, case
from fastapi import HTTPException, status
from app.models.task import CareTask, TaskInstance, TaskParentAssignment
from app.models.parent import ParentProfile
from app.models.family import Family
from app.models.escalation import Escalation
from app.schemas.task import CareTaskCreate, CareTaskUpdate, CareTaskOut, TaskInstanceOut, ParentTaskStatus
from app.utils.datetime_utils import (
    parse_time_string,
    format_time_12h,
    format_datetime_time_12h,
    utcnow,
    get_today_range,
    get_today_datetime,
)
from app.services.notification_service import notification_service

def _is_datetime_past(target_dt: Optional[datetime], now: datetime) -> bool:
    if not target_dt:
        return False
    if target_dt.tzinfo is None and now.tzinfo is not None:
        target_dt = target_dt.replace(tzinfo=timezone.utc)
    elif target_dt.tzinfo is not None and now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now > target_dt

class TaskService:
    def _ensure_today_instances(self, db: Session, family_id: uuid.UUID) -> None:
        """Ensure today's task instances exist for all active tasks and assigned parents."""
        today_start, today_end = get_today_range()

        # Mark any past pending/snoozed task instances from previous days as missed
        past_pending = db.scalars(
            select(TaskInstance).join(CareTask).where(
                CareTask.family_id == family_id,
                TaskInstance.status.in_(["pending", "snoozed"]),
                TaskInstance.scheduled_for < today_start,
            )
        ).all()
        for p_inst in past_pending:
            p_inst.status = "missed"

        active_tasks = db.scalars(
            select(CareTask).where(
                CareTask.family_id == family_id,
                CareTask.is_active == True,
            )
        ).all()

        for task in active_tasks:
            assigned = list(task.assigned_parents)
            if not assigned and task.parent_profile:
                assigned = [task.parent_profile]
            elif not assigned and task.parent_profile_id:
                p = db.get(ParentProfile, task.parent_profile_id)
                if p:
                    assigned = [p]

            try:
                hour, minute = parse_time_string(task.scheduled_time)
            except Exception:
                hour, minute = 9, 0
            scheduled_dt = get_today_datetime(hour, minute)

            end_dt = None
            if task.scheduled_end_time:
                try:
                    eh, em = parse_time_string(task.scheduled_end_time)
                    end_dt = get_today_datetime(eh, em)
                except Exception:
                    pass

            for parent in assigned:
                existing = db.scalar(
                    select(TaskInstance).where(
                        TaskInstance.task_id == task.id,
                        TaskInstance.parent_profile_id == parent.id,
                        TaskInstance.scheduled_for >= today_start,
                        TaskInstance.scheduled_for < today_end,
                    )
                )
                if not existing:
                    instance = TaskInstance(
                        task_id=task.id,
                        parent_profile_id=parent.id,
                        scheduled_for=scheduled_dt,
                        end_time=end_dt,
                        status="pending",
                        notes=task.notes,
                    )
                    db.add(instance)
        db.commit()

    def create_task(
        self,
        db: Session,
        family_id: uuid.UUID,
        task_in: CareTaskCreate,
    ) -> CareTaskOut:
        title = (task_in.title or task_in.name or "").strip()
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task title is required.")

        parent_ids_list = task_in.parent_ids or task_in.parentIds or []
        if not parent_ids_list:
            single_p = task_in.parent_profile_id or task_in.parentId
            if single_p:
                parent_ids_list = [single_p]

        if not parent_ids_list:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one assigned parent is required.")

        valid_parents: List[ParentProfile] = []
        for p_id in parent_ids_list:
            try:
                p_uuid = uuid.UUID(str(p_id))
            except ValueError:
                continue
            parent = db.get(ParentProfile, p_uuid)
            if parent and parent.family_id == family_id:
                if parent not in valid_parents:
                    valid_parents.append(parent)

        if not valid_parents:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid parents found in this family.")

        raw_time = (task_in.scheduled_time or task_in.time or "09:00 AM").strip()
        try:
            h, m = parse_time_string(raw_time)
            normalized_time = format_time_12h(h, m)
        except Exception:
            h, m = 9, 0
            normalized_time = "9:00 AM"

        raw_end_time = (task_in.scheduled_end_time or task_in.end_time or task_in.endTime or "").strip()
        normalized_end_time = None
        end_h, end_m = None, None
        if raw_end_time:
            try:
                end_h, end_m = parse_time_string(raw_end_time)
                normalized_end_time = format_time_12h(end_h, end_m)
            except Exception:
                normalized_end_time = raw_end_time

        repeat = task_in.repeat_pattern or task_in.repeat or "Daily"
        notes = task_in.notes or task_in.detail
        ring_alarm = bool(task_in.ring_alarm if task_in.ring_alarm is not None else task_in.ringAlarm)

        task = CareTask(
            family_id=family_id,
            parent_profile_id=valid_parents[0].id,
            title=title,
            category=task_in.category,
            scheduled_time=normalized_time,
            scheduled_end_time=normalized_end_time,
            repeat_pattern=repeat,
            notes=notes,
            detail=notes,
            ring_alarm=ring_alarm,
            is_active=True,
        )
        db.add(task)
        db.flush()

        for p in valid_parents:
            db.add(TaskParentAssignment(task_id=task.id, parent_profile_id=p.id))
        scheduled_dt = get_today_datetime(h, m)
        end_dt = get_today_datetime(end_h, end_m) if (end_h is not None and end_m is not None) else None

        for p in valid_parents:
            instance = TaskInstance(
                task_id=task.id,
                parent_profile_id=p.id,
                scheduled_for=scheduled_dt,
                end_time=end_dt,
                status="pending",
                reminder_stage=0,
                notes=notes,
            )
            db.add(instance)

        db.commit()
        db.refresh(task)

        parent_ids = [str(p.id) for p in valid_parents]
        parent_names = [p.name for p in valid_parents]
        now = utcnow()
        is_ended = _is_datetime_past(end_dt, now)

        return CareTaskOut(
            id=str(task.id),
            family_id=str(task.family_id),
            parentId=str(valid_parents[0].id),
            parent_profile_id=str(valid_parents[0].id),
            parent_ids=parent_ids,
            parentIds=parent_ids,
            assigned_parent_names=parent_names,
            name=task.title,
            title=task.title,
            category=task.category,  # type: ignore
            time=task.scheduled_time,
            scheduled_time=task.scheduled_time,
            end_time=task.scheduled_end_time,
            endTime=task.scheduled_end_time,
            scheduled_end_time=task.scheduled_end_time,
            status="pending",
            repeat=task.repeat_pattern,
            repeat_pattern=task.repeat_pattern,
            notes=task.notes,
            detail=task.detail,
            ring_alarm=task.ring_alarm,
            ringAlarm=task.ring_alarm,
            is_active=task.is_active,
            is_ended=is_ended,
            isEnded=is_ended,
            created_at=task.created_at,
        )

    def list_tasks(
        self,
        db: Session,
        family_id: uuid.UUID,
        parent_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
    ) -> List[CareTaskOut]:
        self._ensure_today_instances(db, family_id)

        query = select(CareTask).where(
            CareTask.family_id == family_id,
            CareTask.is_active == True,
        )
        if parent_id:
            query = query.where(
                or_(
                    CareTask.parent_profile_id == parent_id,
                    CareTask.assigned_parents.any(ParentProfile.id == parent_id),
                )
            )
        if category and category != "All":
            query = query.where(CareTask.category == category)

        tasks = db.scalars(query.order_by(CareTask.created_at.asc())).all()

        today_start, today_end = get_today_range()
        now = utcnow()

        result: List[CareTaskOut] = []
        for t in tasks:
            today_insts = db.scalars(
                select(TaskInstance).where(
                    TaskInstance.task_id == t.id,
                    TaskInstance.scheduled_for >= today_start,
                    TaskInstance.scheduled_for < today_end,
                )
            ).all()

            assigned_parents = list(t.assigned_parents)
            if not assigned_parents and t.parent_profile:
                assigned_parents = [t.parent_profile]

            parent_statuses: List[ParentTaskStatus] = []
            for p in assigned_parents:
                p_inst = next((i for i in today_insts if i.parent_profile_id == p.id), None)
                p_st = p_inst.status if p_inst else "pending"
                p_comp_at = p_inst.completed_at if p_inst else None
                p_comp_time = format_datetime_time_12h(p_comp_at)
                parent_statuses.append(
                    ParentTaskStatus(
                        parent_id=str(p.id),
                        parentId=str(p.id),
                        parent_name=p.name,
                        parentName=p.name,
                        relationship=p.relationship or "Parent",
                        status=p_st,
                        completed_at=p_comp_at,
                        completed_time=p_comp_time,
                        completedTime=p_comp_time,
                    )
                )

            # Task is only fully completed if all assigned parents completed it
            if parent_statuses and all(ps.status == "completed" for ps in parent_statuses):
                status_val = "completed"
            elif parent_statuses and any(ps.status == "missed" for ps in parent_statuses) and not any(ps.status == "pending" for ps in parent_statuses):
                status_val = "missed"
            else:
                status_val = "pending"

            completed_parents = [ps for ps in parent_statuses if ps.status == "completed" and ps.completed_at]
            comp_at = max((ps.completed_at for ps in completed_parents), default=None) if completed_parents else None
            comp_time = format_datetime_time_12h(comp_at)

            p_ids = [str(p.id) for p in assigned_parents]
            p_names = [p.name for p in assigned_parents]
            primary_pid = p_ids[0] if p_ids else (str(t.parent_profile_id) if t.parent_profile_id else "")

            is_ended = False
            first_inst = today_insts[0] if today_insts else None
            if first_inst and first_inst.end_time:
                is_ended = _is_datetime_past(first_inst.end_time, now)
            elif t.scheduled_end_time:
                try:
                    eh, em = parse_time_string(t.scheduled_end_time)
                    end_dt = get_today_datetime(eh, em)
                    is_ended = _is_datetime_past(end_dt, now)
                except Exception:
                    pass
            elif first_inst and first_inst.scheduled_for:
                is_ended = _is_datetime_past(first_inst.scheduled_for + timedelta(hours=1), now)

            result.append(
                CareTaskOut(
                    id=str(t.id),
                    family_id=str(t.family_id),
                    parentId=primary_pid,
                    parent_profile_id=primary_pid,
                    parent_ids=p_ids,
                    parentIds=p_ids,
                    assigned_parent_names=p_names,
                    parent_statuses=parent_statuses,
                    parentStatuses=parent_statuses,
                    name=t.title,
                    title=t.title,
                    category=t.category,  # type: ignore
                    time=t.scheduled_time,
                    scheduled_time=t.scheduled_time,
                    end_time=t.scheduled_end_time,
                    endTime=t.scheduled_end_time,
                    scheduled_end_time=t.scheduled_end_time,
                    status=status_val,  # type: ignore
                    repeat=t.repeat_pattern,
                    repeat_pattern=t.repeat_pattern,
                    notes=t.notes,
                    detail=t.detail,
                    ring_alarm=t.ring_alarm,
                    ringAlarm=t.ring_alarm,
                    is_active=t.is_active,
                    is_ended=is_ended,
                    isEnded=is_ended,
                    completed_at=comp_at,
                    completed_time=comp_time,
                    completedTime=comp_time,
                    created_at=t.created_at,
                )
            )
        return result

    def get_parent_today_instances(
        self,
        db: Session,
        parent_id: uuid.UUID,
    ) -> List[TaskInstanceOut]:
        parent = db.get(ParentProfile, parent_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found.")

        self._ensure_today_instances(db, parent.family_id)

        today_start, today_end = get_today_range()
        now = utcnow()

        instances = db.scalars(
            select(TaskInstance).where(
                TaskInstance.parent_profile_id == parent_id,
                TaskInstance.scheduled_for >= today_start,
                TaskInstance.scheduled_for < today_end,
            ).order_by(TaskInstance.scheduled_for.asc())
        ).all()

        result: List[TaskInstanceOut] = []
        for inst in instances:
            task = inst.task
            time_display = task.scheduled_time if task else format_datetime_time_12h(inst.scheduled_for)
            end_time_display = task.scheduled_end_time if task else format_datetime_time_12h(inst.end_time)
            title = task.title if task else "Care Task"
            category = task.category if task else "Wellness"
            repeat = task.repeat_pattern if task else "Daily"

            is_ended = False
            if inst.end_time:
                is_ended = _is_datetime_past(inst.end_time, now)
            elif task and task.scheduled_end_time:
                try:
                    eh, em = parse_time_string(task.scheduled_end_time)
                    end_dt = get_today_datetime(eh, em)
                    is_ended = _is_datetime_past(end_dt, now)
                except Exception:
                    pass
            elif inst.scheduled_for:
                is_ended = _is_datetime_past(inst.scheduled_for + timedelta(hours=1), now)

            result.append(
                TaskInstanceOut(
                    id=str(inst.id),
                    taskId=str(inst.task_id),
                    task_id=str(inst.task_id),
                    parentId=str(inst.parent_profile_id),
                    parent_profile_id=str(inst.parent_profile_id),
                    name=title,
                    title=title,
                    category=category,  # type: ignore
                    time=time_display,
                    scheduled_time=time_display,
                    end_time=inst.end_time,
                    endTime=end_time_display,
                    scheduled_end_time=end_time_display,
                    scheduled_for=inst.scheduled_for,
                    status=inst.status,  # type: ignore
                    reminder_stage=inst.reminder_stage,
                    reminderStage=inst.reminder_stage,
                    ring_alarm=task.ring_alarm if task else False,
                    ringAlarm=task.ring_alarm if task else False,
                    repeat=repeat,
                    repeat_pattern=repeat,
                    completed_at=inst.completed_at,
                    completed_time=format_datetime_time_12h(inst.completed_at),
                    completedTime=format_datetime_time_12h(inst.completed_at),
                    snoozed_until=inst.snoozed_until,
                    notes=inst.notes,
                    detail=task.detail if task else None,
                    is_ended=is_ended,
                    isEnded=is_ended,
                )
            )
        return result

    def get_parent_active_instance(
        self,
        db: Session,
        parent_id: uuid.UUID,
    ) -> Optional[TaskInstanceOut]:
        today_instances = self.get_parent_today_instances(db, parent_id)
        for inst in today_instances:
            if inst.status in ("pending", "snoozed"):
                return inst
        return None

    def complete_task(
        self,
        db: Session,
        instance_or_task_id: str,
        is_parent: bool = False,
        target_parent_ids: Optional[List[str]] = None,
    ) -> TaskInstanceOut:
        inst: Optional[TaskInstance] = None
        now = utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        target_uuids: Optional[List[uuid.UUID]] = None
        if target_parent_ids:
            target_uuids = []
            for pid in target_parent_ids:
                try:
                    target_uuids.append(uuid.UUID(str(pid)))
                except ValueError:
                    pass

        try:
            uid = uuid.UUID(instance_or_task_id)
            inst = db.get(TaskInstance, uid)
            if not inst:
                # If target parents specified, find an instance for one of those parents
                if target_uuids:
                    inst = db.scalar(
                        select(TaskInstance).where(
                            TaskInstance.task_id == uid,
                            TaskInstance.parent_profile_id.in_(target_uuids),
                        ).order_by(
                            case(
                                (TaskInstance.status.in_(["pending", "missed", "snoozed"]), 0),
                                else_=1,
                            ),
                            TaskInstance.scheduled_for.desc(),
                        )
                    )
                # First check for today's instance for this care task
                if not inst:
                    inst = db.scalar(
                        select(TaskInstance).where(
                            TaskInstance.task_id == uid,
                            TaskInstance.scheduled_for >= today_start,
                        ).order_by(
                            case(
                                (TaskInstance.status.in_(["pending", "missed", "snoozed"]), 0),
                                else_=1,
                            ),
                            TaskInstance.scheduled_for.desc(),
                        )
                    )
                # Fallback to any recent instance for this care task
                if not inst:
                    inst = db.scalar(
                        select(TaskInstance).where(
                            TaskInstance.task_id == uid,
                        ).order_by(
                            case(
                                (TaskInstance.status.in_(["pending", "missed", "snoozed"]), 0),
                                else_=1,
                            ),
                            TaskInstance.scheduled_for.desc(),
                        )
                    )
        except ValueError:
            pass

        if not inst:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task instance not found.")

        # Check task time slot restriction: parent can only complete during their designated time slot
        is_ended = False
        is_not_started = False
        if inst.end_time:
            is_ended = _is_datetime_past(inst.end_time, now)
        elif inst.task and inst.task.scheduled_end_time:
            try:
                eh, em = parse_time_string(inst.task.scheduled_end_time)
                end_dt = get_today_datetime(eh, em)
                if _is_datetime_past(end_dt, now):
                    is_ended = True
            except Exception:
                pass
        elif inst.scheduled_for:
            is_ended = _is_datetime_past(inst.scheduled_for + timedelta(hours=1), now)

        if inst.scheduled_for and is_parent:
            # Allow parent to complete starting 15 minutes before scheduled start
            start_window = inst.scheduled_for - timedelta(minutes=15)
            if not _is_datetime_past(start_window, now):
                is_not_started = True

        if is_parent and is_ended:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task scheduled time has ended. Only a family caregiver can mark it completed now.",
            )

        if is_parent and is_not_started:
            time_name = inst.task.scheduled_time if inst.task else "its scheduled time"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Task is scheduled for {time_name}. You can only complete tasks during their scheduled time slot.",
            )

        # Collect instances to complete: inst + siblings matching target_parent_ids (or all if not specified)
        instances_to_complete = []
        if target_uuids is not None:
            if inst.parent_profile_id in target_uuids:
                instances_to_complete.append(inst)
            if not is_parent:
                siblings = db.scalars(
                    select(TaskInstance).where(
                        TaskInstance.task_id == inst.task_id,
                        TaskInstance.id != inst.id,
                        TaskInstance.parent_profile_id.in_(target_uuids),
                        TaskInstance.status.in_(["pending", "missed", "snoozed"]),
                    )
                ).all()
                instances_to_complete.extend(siblings)
        else:
            instances_to_complete.append(inst)
            if not is_parent:
                siblings = db.scalars(
                    select(TaskInstance).where(
                        TaskInstance.task_id == inst.task_id,
                        TaskInstance.id != inst.id,
                        TaskInstance.status.in_(["pending", "missed", "snoozed"]),
                    )
                ).all()
                instances_to_complete.extend(siblings)

        for item in instances_to_complete:
            # Only complete uncompleted ones to preserve original completed_at on already finished parents
            if item.status != "completed":
                item.status = "completed"
                item.completed_at = now
                item.snoozed_until = None
            active_escalations = db.scalars(
                select(Escalation).where(
                    Escalation.task_instance_id == item.id,
                    Escalation.status == "active",
                )
            ).all()
            for esc in active_escalations:
                esc.status = "resolved"
                esc.resolved_at = now

        task = inst.task
        parent = inst.parent_profile
        family = parent.family if parent else None

        if family and parent and task:
            notification_service.create_notification(
                db=db,
                family_id=family.id,
                title=f"{parent.name} completed {task.title}",
                message=f"{parent.relationship or 'Parent'} completed '{task.title}'.",
                notification_type="reminder",
                recipient_user_id=family.owner_id,
                parent_profile_id=parent.id,
            )

        db.commit()
        db.refresh(inst)

        time_display = task.scheduled_time if task else format_time_12h(inst.scheduled_for.hour, inst.scheduled_for.minute)
        end_time_display = task.scheduled_end_time if task else (format_time_12h(inst.end_time.hour, inst.end_time.minute) if inst.end_time else None)

        return TaskInstanceOut(
            id=str(inst.id),
            taskId=str(inst.task_id),
            task_id=str(inst.task_id),
            parentId=str(inst.parent_profile_id),
            parent_profile_id=str(inst.parent_profile_id),
            name=task.title if task else "Care Task",
            title=task.title if task else "Care Task",
            category=task.category if task else "Wellness",  # type: ignore
            time=time_display,
            scheduled_time=time_display,
            end_time=inst.end_time,
            endTime=end_time_display,
            scheduled_end_time=end_time_display,
            scheduled_for=inst.scheduled_for,
            status=inst.status,  # type: ignore
            reminder_stage=inst.reminder_stage,
            reminderStage=inst.reminder_stage,
            ring_alarm=task.ring_alarm if task else False,
            ringAlarm=task.ring_alarm if task else False,
            repeat=task.repeat_pattern if task else "Daily",
            repeat_pattern=task.repeat_pattern if task else "Daily",
            completed_at=inst.completed_at,
            completed_time=format_datetime_time_12h(inst.completed_at),
            completedTime=format_datetime_time_12h(inst.completed_at),
            snoozed_until=inst.snoozed_until,
            notes=inst.notes,
            detail=task.detail if task else None,
            is_ended=is_ended,
            isEnded=is_ended,
        )

    def snooze_task(
        self,
        db: Session,
        instance_or_task_id: str,
        snooze_minutes: int = 10,
    ) -> TaskInstanceOut:
        inst: Optional[TaskInstance] = None
        now = utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        try:
            uid = uuid.UUID(instance_or_task_id)
            inst = db.get(TaskInstance, uid)
            if not inst:
                inst = db.scalar(
                    select(TaskInstance).where(
                        TaskInstance.task_id == uid,
                        TaskInstance.scheduled_for >= today_start,
                    )
                )
        except ValueError:
            pass

        if not inst:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task instance not found.")

        inst.status = "snoozed"
        inst.snoozed_until = now + timedelta(minutes=snooze_minutes)

        task = inst.task
        parent = inst.parent_profile
        family = parent.family if parent else None

        if family and parent and task:
            notification_service.create_notification(
                db=db,
                family_id=family.id,
                title=f"{parent.name} snoozed {task.title}",
                message=f"Task snoozed for {snooze_minutes} minutes.",
                notification_type="reminder",
                recipient_user_id=family.owner_id,
                parent_profile_id=parent.id,
            )

        db.commit()
        db.refresh(inst)

        time_display = task.scheduled_time if task else format_time_12h(inst.scheduled_for.hour, inst.scheduled_for.minute)
        end_time_display = task.scheduled_end_time if task else (format_time_12h(inst.end_time.hour, inst.end_time.minute) if inst.end_time else None)

        if inst.end_time:
            is_ended = _is_datetime_past(inst.end_time, now)
        elif task and task.scheduled_end_time:
            try:
                eh, em = parse_time_string(task.scheduled_end_time)
                end_dt = get_today_datetime(eh, em)
                is_ended = _is_datetime_past(end_dt, now)
            except Exception:
                is_ended = False
        elif inst.scheduled_for:
            is_ended = _is_datetime_past(inst.scheduled_for + timedelta(hours=1), now)
        else:
            is_ended = False

        return TaskInstanceOut(
            id=str(inst.id),
            taskId=str(inst.task_id),
            task_id=str(inst.task_id),
            parentId=str(inst.parent_profile_id),
            parent_profile_id=str(inst.parent_profile_id),
            name=task.title if task else "Care Task",
            title=task.title if task else "Care Task",
            category=task.category if task else "Wellness",  # type: ignore
            time=time_display,
            scheduled_time=time_display,
            end_time=inst.end_time,
            endTime=end_time_display,
            scheduled_end_time=end_time_display,
            scheduled_for=inst.scheduled_for,
            status=inst.status,  # type: ignore
            reminder_stage=inst.reminder_stage,
            reminderStage=inst.reminder_stage,
            ring_alarm=task.ring_alarm if task else False,
            ringAlarm=task.ring_alarm if task else False,
            repeat=task.repeat_pattern if task else "Daily",
            repeat_pattern=task.repeat_pattern if task else "Daily",
            completed_at=inst.completed_at,
            snoozed_until=inst.snoozed_until,
            notes=inst.notes,
            detail=task.detail if task else None,
            is_ended=is_ended,
            isEnded=is_ended,
        )

    def get_task(self, db: Session, task_id: uuid.UUID, family_id: uuid.UUID) -> CareTaskOut:
        task = db.get(CareTask, task_id)
        if not task or task.family_id != family_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

        today_start, today_end = get_today_range()
        now = utcnow()
        today_insts = db.scalars(
            select(TaskInstance).where(
                TaskInstance.task_id == task.id,
                TaskInstance.scheduled_for >= today_start,
                TaskInstance.scheduled_for < today_end,
            )
        ).all()

        assigned_parents = list(task.assigned_parents)
        if not assigned_parents and task.parent_profile:
            assigned_parents = [task.parent_profile]

        parent_statuses: List[ParentTaskStatus] = []
        for p in assigned_parents:
            p_inst = next((i for i in today_insts if i.parent_profile_id == p.id), None)
            p_st = p_inst.status if p_inst else "pending"
            p_comp_at = p_inst.completed_at if p_inst else None
            p_comp_time = format_datetime_time_12h(p_comp_at)
            parent_statuses.append(
                ParentTaskStatus(
                    parent_id=str(p.id),
                    parentId=str(p.id),
                    parent_name=p.name,
                    parentName=p.name,
                    relationship=p.relationship or "Parent",
                    status=p_st,
                    completed_at=p_comp_at,
                    completed_time=p_comp_time,
                    completedTime=p_comp_time,
                )
            )

        if parent_statuses and all(ps.status == "completed" for ps in parent_statuses):
            status_val = "completed"
        elif parent_statuses and any(ps.status == "missed" for ps in parent_statuses) and not any(ps.status == "pending" for ps in parent_statuses):
            status_val = "missed"
        else:
            status_val = "pending"

        completed_parents = [ps for ps in parent_statuses if ps.status == "completed" and ps.completed_at]
        comp_at = max((ps.completed_at for ps in completed_parents), default=None) if completed_parents else None
        comp_time = format_datetime_time_12h(comp_at)

        p_ids = [str(p.id) for p in assigned_parents]
        p_names = [p.name for p in assigned_parents]
        primary_pid = p_ids[0] if p_ids else ""

        is_ended = False
        first_inst = today_insts[0] if today_insts else None
        if first_inst and first_inst.end_time:
            is_ended = _is_datetime_past(first_inst.end_time, now)
        elif task.scheduled_end_time:
            try:
                eh, em = parse_time_string(task.scheduled_end_time)
                end_dt = get_today_datetime(eh, em)
                is_ended = _is_datetime_past(end_dt, now)
            except Exception:
                pass

        return CareTaskOut(
            id=str(task.id),
            family_id=str(task.family_id),
            parentId=primary_pid,
            parent_profile_id=primary_pid,
            parent_ids=p_ids,
            parentIds=p_ids,
            assigned_parent_names=p_names,
            parent_statuses=parent_statuses,
            parentStatuses=parent_statuses,
            name=task.title,
            title=task.title,
            category=task.category,  # type: ignore
            time=task.scheduled_time,
            scheduled_time=task.scheduled_time,
            end_time=task.scheduled_end_time,
            endTime=task.scheduled_end_time,
            scheduled_end_time=task.scheduled_end_time,
            status=status_val,  # type: ignore
            repeat=task.repeat_pattern,
            repeat_pattern=task.repeat_pattern,
            notes=task.notes,
            detail=task.detail,
            ring_alarm=task.ring_alarm,
            ringAlarm=task.ring_alarm,
            is_active=task.is_active,
            is_ended=is_ended,
            isEnded=is_ended,
            completed_at=comp_at,
            completed_time=comp_time,
            completedTime=comp_time,
            created_at=task.created_at,
        )

    def update_task(
        self,
        db: Session,
        task_id: uuid.UUID,
        family_id: uuid.UUID,
        task_in: CareTaskUpdate,
    ) -> CareTaskOut:
        task = db.get(CareTask, task_id)
        if not task or task.family_id != family_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

        title = task_in.title or task_in.name
        if title is not None and title.strip():
            task.title = title.strip()

        if task_in.category is not None:
            task.category = task_in.category

        # Multi-parent assignment update
        parent_ids_list = task_in.parent_ids or task_in.parentIds
        if parent_ids_list is None:
            single_p = task_in.parent_profile_id or task_in.parentId
            if single_p:
                parent_ids_list = [single_p]

        if parent_ids_list is not None and len(parent_ids_list) > 0:
            valid_parents = []
            for p_id in parent_ids_list:
                try:
                    p_uuid = uuid.UUID(str(p_id))
                    p = db.get(ParentProfile, p_uuid)
                    if p and p.family_id == family_id:
                        if p not in valid_parents:
                            valid_parents.append(p)
                except ValueError:
                    pass

            if valid_parents:
                task.parent_profile_id = valid_parents[0].id
                db.query(TaskParentAssignment).filter(TaskParentAssignment.task_id == task.id).delete()
                for p in valid_parents:
                    db.add(TaskParentAssignment(task_id=task.id, parent_profile_id=p.id))

        raw_time = task_in.scheduled_time or task_in.time
        new_h, new_m = None, None
        if raw_time is not None and raw_time.strip():
            try:
                new_h, new_m = parse_time_string(raw_time)
                task.scheduled_time = format_time_12h(new_h, new_m)
            except Exception:
                task.scheduled_time = raw_time.strip()

        raw_end_time = task_in.scheduled_end_time or task_in.end_time or task_in.endTime
        new_end_h, new_end_m = None, None
        if raw_end_time is not None:
            if raw_end_time.strip():
                try:
                    new_end_h, new_end_m = parse_time_string(raw_end_time)
                    task.scheduled_end_time = format_time_12h(new_end_h, new_end_m)
                except Exception:
                    task.scheduled_end_time = raw_end_time.strip()
            else:
                task.scheduled_end_time = None

        repeat = task_in.repeat_pattern or task_in.repeat
        if repeat is not None:
            task.repeat_pattern = repeat

        if task_in.notes is not None or task_in.detail is not None:
            notes = task_in.notes if task_in.notes is not None else task_in.detail
            task.notes = notes
            task.detail = notes

        if task_in.is_active is not None:
            task.is_active = task_in.is_active

        if task_in.ring_alarm is not None or task_in.ringAlarm is not None:
            task.ring_alarm = bool(task_in.ring_alarm if task_in.ring_alarm is not None else task_in.ringAlarm)

        db.commit()
        db.refresh(task)

        today_start, today_end = get_today_range()

        assigned = list(task.assigned_parents)
        if not assigned and task.parent_profile:
            assigned = [task.parent_profile]

        for p in assigned:
            inst = db.scalar(
                select(TaskInstance).where(
                    TaskInstance.task_id == task.id,
                    TaskInstance.parent_profile_id == p.id,
                    TaskInstance.scheduled_for >= today_start,
                    TaskInstance.scheduled_for < today_end,
                )
            )
            if not inst:
                try:
                    th, tm = parse_time_string(task.scheduled_time)
                except Exception:
                    th, tm = 9, 0
                s_dt = get_today_datetime(th, tm)
                e_dt = None
                if task.scheduled_end_time:
                    try:
                        eh, em = parse_time_string(task.scheduled_end_time)
                        e_dt = get_today_datetime(eh, em)
                    except Exception:
                        pass
                inst = TaskInstance(
                    task_id=task.id,
                    parent_profile_id=p.id,
                    scheduled_for=s_dt,
                    end_time=e_dt,
                    status="pending",
                    notes=task.notes,
                )
                db.add(inst)
            elif inst.status == "pending":
                inst.notes = task.notes
                if new_h is not None and new_m is not None:
                    inst.scheduled_for = get_today_datetime(new_h, new_m)
                if new_end_h is not None and new_end_m is not None:
                    inst.end_time = get_today_datetime(new_end_h, new_end_m)
        db.commit()

        p_ids = [str(p.id) for p in task.assigned_parents]
        if not p_ids and task.parent_profile_id:
            p_ids = [str(task.parent_profile_id)]
        p_names = [p.name for p in task.assigned_parents]
        if not p_names and task.parent_profile:
            p_names = [task.parent_profile.name]

        primary_pid = p_ids[0] if p_ids else ""

        is_ended = False
        if task.scheduled_end_time:
            try:
                eh, em = parse_time_string(task.scheduled_end_time)
                end_dt = get_today_datetime(eh, em)
                is_ended = _is_datetime_past(end_dt, now)
            except Exception:
                pass

        return CareTaskOut(
            id=str(task.id),
            family_id=str(task.family_id),
            parentId=primary_pid,
            parent_profile_id=primary_pid,
            parent_ids=p_ids,
            parentIds=p_ids,
            assigned_parent_names=p_names,
            name=task.title,
            title=task.title,
            category=task.category,  # type: ignore
            time=task.scheduled_time,
            scheduled_time=task.scheduled_time,
            end_time=task.scheduled_end_time,
            endTime=task.scheduled_end_time,
            scheduled_end_time=task.scheduled_end_time,
            status="pending",
            repeat=task.repeat_pattern,
            repeat_pattern=task.repeat_pattern,
            notes=task.notes,
            detail=task.detail,
            ring_alarm=task.ring_alarm,
            ringAlarm=task.ring_alarm,
            is_active=task.is_active,
            is_ended=is_ended,
            isEnded=is_ended,
            created_at=task.created_at,
        )

    def delete_task(self, db: Session, task_id: uuid.UUID, family_id: uuid.UUID) -> bool:
        task = db.get(CareTask, task_id)
        if not task or task.family_id != family_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
        db.delete(task)
        db.commit()
        return True

    get_task_by_id = get_task

task_service = TaskService()
