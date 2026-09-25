import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.user import User
from app.models.family import Family, FamilyMember
from app.models.parent import ParentProfile
from app.models.task import CareTask, TaskInstance
from app.models.escalation import Escalation
from app.models.invite import FamilyInvite
from app.core.security import get_password_hash
from app.utils.datetime_utils import utcnow
from app.utils.tokens import generate_secure_invite_token, generate_short_code

def seed_initial_data(db: Session) -> None:
    # Check if already seeded
    existing_user = db.scalar(select(User).where(User.email == "aditya@example.com"))
    if existing_user:
        return

    now = utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Create child user
    child = User(
        email="aditya@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Aditya Tayal",
        role="child",
    )
    db.add(child)
    db.flush()

    # 2. Create family
    family = Family(
        name="Tayal family",
        owner_id=child.id,
    )
    db.add(family)
    db.flush()

    # 3. Add child as owner
    member = FamilyMember(
        family_id=family.id,
        user_id=child.id,
        role="child_owner",
    )
    db.add(member)

    # 4. Parents
    mom = ParentProfile(
        family_id=family.id,
        name="Meera Tayal",
        relationship="Mom",
        initials="MT",
        color="peach",
    )
    dad = ParentProfile(
        family_id=family.id,
        name="Rajesh Tayal",
        relationship="Dad",
        initials="RT",
        color="mint",
    )
    db.add_all([mom, dad])
    db.flush()

    # 5. Invites
    inv_mom = FamilyInvite(
        family_id=family.id,
        parent_profile_id=mom.id,
        token="demo-mom-token",
        code="MOM123",
        expires_at=now + timedelta(days=30),
        is_used=False,
        created_by_user_id=child.id,
    )
    inv_dad = FamilyInvite(
        family_id=family.id,
        parent_profile_id=dad.id,
        token="demo-dad-token",
        code="DAD123",
        expires_at=now + timedelta(days=30),
        is_used=False,
        created_by_user_id=child.id,
    )
    db.add_all([inv_mom, inv_dad])

    # 6. Tasks
    tasks_def = [
        {"title": "Breakfast", "cat": "Meal", "p": mom, "time": "8:00 AM", "detail": "Oats, banana & milk", "status": "completed", "h": 8, "m": 0},
        {"title": "Morning medicine", "cat": "Medicine", "p": mom, "time": "9:30 AM", "detail": "Vitamin D & calcium", "status": "pending", "h": 9, "m": 30},
        {"title": "Morning walk", "cat": "Exercise", "p": mom, "time": "10:30 AM", "detail": "A gentle walk outside", "status": "completed", "h": 10, "m": 30},
        {"title": "Lunch", "cat": "Meal", "p": mom, "time": "1:00 PM", "detail": "Dal, rice & vegetables", "status": "pending", "h": 13, "m": 0},
        {"title": "BP medicine", "cat": "Medicine", "p": dad, "time": "8:30 AM", "detail": "Amlodipine 5mg", "status": "completed", "h": 8, "m": 30},
        {"title": "Breakfast", "cat": "Meal", "p": dad, "time": "9:00 AM", "detail": "Toast & fruit", "status": "missed", "h": 9, "m": 0},
        {"title": "Evening stretches", "cat": "Exercise", "p": dad, "time": "5:00 PM", "detail": "15 minutes of gentle stretches", "status": "pending", "h": 17, "m": 0},
        {"title": "Doctor check-in", "cat": "Appointment", "p": dad, "time": "4:00 PM", "detail": "Routine check-up with Dr. Shah", "status": "pending", "h": 16, "m": 0},
    ]

    instances_to_escalate = []
    for td in tasks_def:
        ct = CareTask(
            family_id=family.id,
            parent_profile_id=td["p"].id,
            title=td["title"],
            category=td["cat"],
            scheduled_time=td["time"],
            repeat_pattern="Daily",
            notes=td["detail"],
            detail=td["detail"],
            is_active=True,
        )
        db.add(ct)
        db.flush()

        inst = TaskInstance(
            task_id=ct.id,
            parent_profile_id=td["p"].id,
            scheduled_for=today_start.replace(hour=td["h"], minute=td["m"]),
            status=td["status"],
            completed_at=now - timedelta(hours=1) if td["status"] == "completed" else None,
            notes=td["detail"],
        )
        db.add(inst)
        db.flush()
        if td["status"] == "missed":
            instances_to_escalate.append((inst, td["p"], td["title"], td["time"]))

    # 7. Escalations
    for inst, parent, task_title, task_time in instances_to_escalate:
        esc = Escalation(
            family_id=family.id,
            task_instance_id=inst.id,
            parent_profile_id=parent.id,
            title=f"{parent.relationship} missed {task_title}",
            detail=f"{parent.name} has not confirmed their {task_time} {task_title}.",
            priority="High",
            escalation_type="Missed task",
            status="active",
        )
        db.add(esc)

    db.commit()
