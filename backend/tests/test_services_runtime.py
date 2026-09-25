import pytest
import uuid
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User
from app.models.family import Family, FamilyMember
from app.models.parent import ParentProfile
from app.models.task import CareTask, TaskInstance
from app.models.device_token import DeviceToken
from app.models.notification_delivery import NotificationDelivery
from app.models.escalation import Escalation
from app.core.security import create_access_token
from services_runtime.delivery.base import PushPayload
from services_runtime.delivery.providers.mock import MockProvider
from services_runtime.delivery.dispatcher import NotificationDispatcher
from services_runtime.scheduler.poller import poll_and_dispatch_reminders
from services_runtime.escalations.engine import evaluate_and_escalate_overdue_tasks

@pytest.fixture
def auth_child(db: Session):
    user = User(
        email=f"child_{uuid.uuid4().hex[:8]}@example.com",
        full_name="Test Child",
        role="child",
    )
    db.add(user)
    db.flush()

    family = Family(name="Test Family", owner_id=user.id)
    db.add(family)
    db.flush()

    member = FamilyMember(family_id=family.id, user_id=user.id, role="child_owner")
    db.add(member)

    parent = ParentProfile(
        family_id=family.id,
        name="Test Mom",
        relationship="Mom",
        initials="TM",
    )
    db.add(parent)
    db.commit()
    db.refresh(user)
    db.refresh(parent)
    db.refresh(family)

    token = create_access_token(subject=str(user.id), extra_claims={"role": "child"})
    return {"user": user, "family": family, "parent": parent, "token": token}

def test_device_token_lifecycle(client: TestClient, auth_child):
    headers = {"Authorization": f"Bearer {auth_child['token']}"}

    # 1. Register device
    reg_resp = client.post(
        "/api/v1/devices/register",
        headers=headers,
        json={
            "token": "ExponentPushToken[test-mobile-token-123]",
            "device_name": "iPhone 15 Pro",
            "platform": "ios",
            "provider": "expo",
        },
    )
    assert reg_resp.status_code == 200
    data = reg_resp.json()
    assert data["token"] == "ExponentPushToken[test-mobile-token-123]"
    assert data["is_active"] is True

    # 2. List devices
    list_resp = client.get("/api/v1/devices", headers=headers)
    assert list_resp.status_code == 200
    devices = list_resp.json()
    assert len(devices) >= 1
    assert any(d["token"] == "ExponentPushToken[test-mobile-token-123]" for d in devices)

    # 3. Unregister device
    unreg_resp = client.post(
        "/api/v1/devices/unregister",
        headers=headers,
        json={"token": "ExponentPushToken[test-mobile-token-123]"},
    )
    assert unreg_resp.status_code == 200
    assert unreg_resp.json()["status"] == "unregistered"

    # 4. List devices should no longer show the deactivated token
    list_after = client.get("/api/v1/devices", headers=headers)
    assert not any(d["token"] == "ExponentPushToken[test-mobile-token-123]" for d in list_after.json())

@pytest.mark.asyncio
async def test_mock_provider_and_delivery_audit(db: Session, auth_child):
    user = auth_child["user"]
    mock_prov = MockProvider()
    dispatcher = NotificationDispatcher(provider=mock_prov)

    # Register active token
    dev = DeviceToken(
        user_id=user.id,
        token="ExponentPushToken[mock-user-device]",
        provider="mock",
        platform="android",
        is_active=True,
    )
    db.add(dev)
    db.commit()

    payload = PushPayload(
        title="Good morning",
        body="It is time for morning wellness.",
        data={"action": "open_app"},
    )

    results = await dispatcher.dispatch_to_recipient(db=db, payload=payload, user_id=user.id)
    assert len(results) == 1
    assert results[0].status == "sent"
    assert len(mock_prov.sent_deliveries) == 1

    # Verify audit record in notification_deliveries
    deliveries = db.scalars(
        select(NotificationDelivery).where(NotificationDelivery.recipient_token == dev.token)
    ).all()
    assert len(deliveries) >= 1
    assert deliveries[0].status == "sent"

@pytest.mark.asyncio
async def test_scheduler_poller_and_escalations(db: Session, auth_child):
    user = auth_child["user"]
    family = auth_child["family"]
    parent = auth_child["parent"]

    now = datetime.now(timezone.utc)

    # Create task
    task = CareTask(
        family_id=family.id,
        parent_profile_id=parent.id,
        title="Blood Pressure Check",
        category="Medicine",
        scheduled_time="09:00 AM",
        scheduled_end_time="10:00 AM",
        reminder_interval_minutes=0,
        escalation_threshold_minutes=15,
    )
    db.add(task)
    db.flush()

    # Create instance scheduled for right now
    inst = TaskInstance(
        task_id=task.id,
        parent_profile_id=parent.id,
        scheduled_for=now,
        end_time=now - timedelta(minutes=20),  # 20 mins ago -> overdue past 15m threshold
        status="pending",
    )
    db.add(inst)
    db.commit()

    # 1. Test reminder dispatch
    dispatched = await poll_and_dispatch_reminders(db, force_instance_id=inst.id)
    assert inst.id in dispatched

    # 2. Test escalation evaluation
    escalated = await evaluate_and_escalate_overdue_tasks(db, force_instance_id=inst.id)
    assert inst.id in escalated

    # Verify task instance status changed to missed
    db.refresh(inst)
    assert inst.status == "missed"

    # Verify Escalation record created
    esc = db.scalar(select(Escalation).where(Escalation.task_instance_id == inst.id))
    assert esc is not None
    assert esc.priority == "High"  # Medicine category triggers High priority

def test_dev_simulation_endpoints(client: TestClient, db: Session, auth_child):
    headers = {"Authorization": f"Bearer {auth_child['token']}"}
    family = auth_child["family"]
    parent = auth_child["parent"]

    now = datetime.now(timezone.utc)
    task = CareTask(
        family_id=family.id,
        parent_profile_id=parent.id,
        title="Walk in Garden",
        category="Exercise",
        scheduled_time="05:00 PM",
    )
    db.add(task)
    db.flush()

    inst = TaskInstance(
        task_id=task.id,
        parent_profile_id=parent.id,
        scheduled_for=now,
        status="pending",
    )
    db.add(inst)
    db.commit()

    # 1. Trigger test reminder
    r1 = client.post(f"/api/v1/dev/test-reminder/{inst.id}", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["status"] == "success"

    # 2. Trigger test escalation
    r2 = client.post(f"/api/v1/dev/test-escalation/{inst.id}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["status"] == "success"

    # 3. Direct push test endpoint
    r3 = client.post(
        "/api/v1/dev/push-test",
        headers=headers,
        json={"token": "ExponentPushToken[direct-test-123]", "title": "Test", "body": "Direct push"},
    )
    assert r3.status_code == 200
    assert r3.json()["status"] == "completed"

@pytest.mark.asyncio
async def test_four_stage_reminder_and_urgent_alarm(db: Session, auth_child):
    family = auth_child["family"]
    parent = auth_child["parent"]
    parent.phone = "+1234567890"
    db.commit()

    now = datetime.now(timezone.utc)
    task = CareTask(
        family_id=family.id,
        parent_profile_id=parent.id,
        title="Morning Blood Pressure Medicine",
        category="Medicine",
        scheduled_time="08:00 AM",
        ring_alarm=True,
        escalation_threshold_minutes=45,
    )
    db.add(task)
    db.flush()

    inst = TaskInstance(
        task_id=task.id,
        parent_profile_id=parent.id,
        scheduled_for=now - timedelta(minutes=50),
        status="pending",
        reminder_stage=0,
    )
    db.add(inst)
    db.commit()

    # Stage 0 (0m time reached)
    d0 = await poll_and_dispatch_reminders(db, force_instance_id=inst.id, force_stage=0)
    assert inst.id in d0
    db.refresh(inst)
    assert inst.reminder_stage == 1

    # Stage 1 (+15m overdue)
    d1 = await poll_and_dispatch_reminders(db, force_instance_id=inst.id, force_stage=1)
    assert inst.id in d1
    db.refresh(inst)
    assert inst.reminder_stage == 2

    # Stage 2 (+30m overdue)
    d2 = await poll_and_dispatch_reminders(db, force_instance_id=inst.id, force_stage=2)
    assert inst.id in d2
    db.refresh(inst)
    assert inst.reminder_stage == 3

    # Stage 3 (+45m overdue -> alarm parent again and alarm child to call parent)
    # Task remains pending so parent can still complete it!
    d3 = await poll_and_dispatch_reminders(db, force_instance_id=inst.id, force_stage=3)
    assert inst.id in d3
    db.refresh(inst)
    assert inst.reminder_stage == 4
    assert inst.status == "pending"

    # Verify Escalation record created with action_type="call_parent"
    esc = db.scalar(select(Escalation).where(Escalation.task_instance_id == inst.id))
    assert esc is not None
    assert "Call" in esc.title
    assert esc.action_type == "call_parent"
    assert esc.priority == "High"

    # Stage 4 / Deadline reached (end time or after 1 hr) -> marked missed
    d4 = await poll_and_dispatch_reminders(db, force_instance_id=inst.id, force_stage=4)
    assert inst.id in d4
    db.refresh(inst)
    assert inst.reminder_stage == 5
    assert inst.status == "missed"

    # Verify escalation detail updated to missed task
    db.refresh(esc)
    assert esc.escalation_type == "Missed task"

@pytest.mark.asyncio
async def test_deadline_marking_missed_end_time_and_one_hour(db: Session, auth_child):
    family = auth_child["family"]
    parent = auth_child["parent"]
    now = datetime.now(timezone.utc)

    # Task A: Has explicit end_time 30 mins after start, now is 35 mins after start -> ended
    task_a = CareTask(
        family_id=family.id,
        parent_profile_id=parent.id,
        title="Morning Walk",
        category="Exercise",
        scheduled_time="07:00 AM",
        scheduled_end_time="07:30 AM",
    )
    db.add(task_a)
    db.flush()

    inst_a = TaskInstance(
        task_id=task_a.id,
        parent_profile_id=parent.id,
        scheduled_for=now - timedelta(minutes=35),
        end_time=now - timedelta(minutes=5),  # End time 5 mins ago
        status="pending",
        reminder_stage=0,
    )
    db.add(inst_a)

    # Task B: Has NO end_time, scheduled 65 mins ago -> past 1 hr deadline
    task_b = CareTask(
        family_id=family.id,
        parent_profile_id=parent.id,
        title="Vitamins",
        category="Medicine",
        scheduled_time="08:00 AM",
    )
    db.add(task_b)
    db.flush()

    inst_b = TaskInstance(
        task_id=task_b.id,
        parent_profile_id=parent.id,
        scheduled_for=now - timedelta(minutes=65),
        status="pending",
        reminder_stage=0,
    )
    db.add(inst_b)
    db.commit()

    # When poller runs without forcing stage, both should be marked as missed due to deadline expiration
    d = await poll_and_dispatch_reminders(db)
    assert inst_a.id in d
    assert inst_b.id in d

    db.refresh(inst_a)
    db.refresh(inst_b)
    assert inst_a.status == "missed"
    assert inst_a.reminder_stage == 5
    assert inst_b.status == "missed"
    assert inst_b.reminder_stage == 5


