from fastapi.testclient import TestClient

def test_task_crud_and_completion_lifecycle(client: TestClient):
    # Register child
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "daughter@example.com",
        "password": "password123",
        "full_name": "Daughter",
        "role": "child"
    })
    child_token = reg_res.json()["access_token"]
    child_headers = {"Authorization": f"Bearer {child_token}"}

    # Add Dad
    parent_res = client.post("/api/v1/parents", json={
        "name": "Dad",
        "relationship": "Dad",
        "color": "mint"
    }, headers=child_headers)
    dad_id = parent_res.json()["id"]

    # Create Care Task: BP Medicine
    task_res = client.post("/api/v1/tasks", json={
        "title": "BP Medicine",
        "category": "Medicine",
        "parent_profile_id": dad_id,
        "scheduled_time": "08:30 AM",
        "repeat_pattern": "Daily",
        "notes": "Take with water after breakfast"
    }, headers=child_headers)
    assert task_res.status_code == 201
    task_data = task_res.json()
    assert task_data["name"] == "BP Medicine"
    assert task_data["status"] == "pending"

    # List tasks for child
    list_res = client.get("/api/v1/tasks", headers=child_headers)
    assert list_res.status_code == 200
    tasks = list_res.json()
    assert len(tasks) == 1
    assert tasks[0]["name"] == "BP Medicine"

    # Parent today's schedule
    sched_res = client.get(f"/api/v1/task-instances/parent/{dad_id}/today")
    assert sched_res.status_code == 200
    today_tasks = sched_res.json()
    assert len(today_tasks) == 1
    instance_id = today_tasks[0]["id"]
    assert today_tasks[0]["status"] == "pending"

    # Parent active task
    active_res = client.get(f"/api/v1/task-instances/parent/{dad_id}/active")
    assert active_res.status_code == 200
    assert active_res.json()["id"] == instance_id

    # Snooze task
    snooze_res = client.post(f"/api/v1/task-instances/{instance_id}/snooze", json={
        "action": "snooze",
        "snooze_minutes": 10
    })
    assert snooze_res.status_code == 200
    assert snooze_res.json()["status"] == "snoozed"

    # Complete task
    comp_res = client.post(f"/api/v1/task-instances/{instance_id}/complete")
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"

    # Active task should now be empty (all tasks completed)
    active_after = client.get(f"/api/v1/task-instances/parent/{dad_id}/active")
    assert active_after.status_code == 200
    assert active_after.json() is None

    # Update Task
    task_id = task_data["id"]
    upd_res = client.put(f"/api/v1/tasks/{task_id}", json={
        "name": "BP Medicine (Updated)",
        "time": "09:00 AM",
        "notes": "Take 1 tablet"
    }, headers=child_headers)
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "BP Medicine (Updated)"

    # Get Single Task
    get_res = client.get(f"/api/v1/tasks/{task_id}", headers=child_headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "BP Medicine (Updated)"

    # Delete Task
    del_res = client.delete(f"/api/v1/tasks/{task_id}", headers=child_headers)
    assert del_res.status_code == 204

    # Verify task deleted
    list_after_del = client.get("/api/v1/tasks", headers=child_headers)
    assert list_after_del.status_code == 200
    assert len(list_after_del.json()) == 0

def test_parent_update_and_delete(client: TestClient):
    # Register child
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "son2@example.com",
        "password": "password123",
        "full_name": "Son Two",
        "role": "child"
    })
    child_token = reg_res.json()["access_token"]
    child_headers = {"Authorization": f"Bearer {child_token}"}

    # Create parent
    p_res = client.post("/api/v1/parents", json={
        "name": "Mom",
        "relationship": "Mom",
        "color": "peach"
    }, headers=child_headers)
    assert p_res.status_code == 201
    parent_id = p_res.json()["id"]

    # Update parent
    upd_res = client.put(f"/api/v1/parents/{parent_id}", json={
        "name": "Mother Mary",
        "relationship": "Mom",
        "color": "lavender"
    }, headers=child_headers)
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "Mother Mary"
    assert upd_res.json()["color"] == "lavender"

    # Delete parent
    del_res = client.delete(f"/api/v1/parents/{parent_id}", headers=child_headers)
    assert del_res.status_code == 204

    # Verify parent deleted
    list_res = client.get("/api/v1/parents", headers=child_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 0

def test_reaccess_parent_invite(client: TestClient):
    reg = client.post("/api/v1/auth/register", json={
        "email": "invite_test@example.com",
        "password": "password123",
        "full_name": "Invite Tester",
        "role": "child"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create parent
    p_res = client.post("/api/v1/parents", json={"name": "Grandpa", "relationship": "Grandfather"}, headers=headers)
    parent_id = p_res.json()["id"]

    # Re-access invite code and QR value
    inv_res = client.get(f"/api/v1/invites/parent/{parent_id}", headers=headers)
    assert inv_res.status_code == 200
    data = inv_res.json()
    assert len(data["code"]) == 6
    assert data["qr_value"].startswith("carecircle://join/")

    # Regenerate invite code
    regen_res = client.post(f"/api/v1/invites/parent/{parent_id}/regenerate", headers=headers)
    assert regen_res.status_code == 200
    regen_data = regen_res.json()
    assert len(regen_data["code"]) == 6

def test_multi_parent_task_assignment(client: TestClient):
    reg = client.post("/api/v1/auth/register", json={
        "email": "multiparent@example.com",
        "password": "password123",
        "full_name": "Multi Tester",
        "role": "child"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create 2 parents
    p1 = client.post("/api/v1/parents", json={"name": "Mom", "relationship": "Mom"}, headers=headers).json()["id"]
    p2 = client.post("/api/v1/parents", json={"name": "Dad", "relationship": "Dad"}, headers=headers).json()["id"]

    # Create 1 task assigned to BOTH parents
    t_res = client.post("/api/v1/tasks", json={
        "name": "Evening Family Walk",
        "category": "Exercise",
        "parent_ids": [p1, p2],
        "time": "06:00 PM",
        "endTime": "07:00 PM"
    }, headers=headers)
    assert t_res.status_code == 201
    task_out = t_res.json()
    assert len(task_out["parent_ids"]) == 2
    assert p1 in task_out["parent_ids"]
    assert p2 in task_out["parent_ids"]

    # Verify both parents have an instance scheduled
    sched1 = client.get(f"/api/v1/task-instances/parent/{p1}/today").json()
    sched2 = client.get(f"/api/v1/task-instances/parent/{p2}/today").json()
    assert len(sched1) == 1
    assert len(sched2) == 1
    assert sched1[0]["name"] == "Evening Family Walk"
    assert sched2[0]["name"] == "Evening Family Walk"

def test_task_end_time_completion_rules(client: TestClient):
    reg = client.post("/api/v1/auth/register", json={
        "email": "endtime@example.com",
        "password": "password123",
        "full_name": "End Tester",
        "role": "child"
    })
    child_token = reg.json()["access_token"]
    child_headers = {"Authorization": f"Bearer {child_token}"}

    # Create parent
    p_res = client.post("/api/v1/parents", json={"name": "Mom", "relationship": "Mom"}, headers=child_headers)
    p_data = p_res.json()
    parent_id = p_data["id"]
    short_code = p_data["short_code"]

    # Parent joins via short code to obtain parent token
    join_res = client.post("/api/v1/invites/accept", json={"code": short_code})
    assert join_res.status_code == 200
    parent_token = join_res.json()["access_token"]
    parent_headers = {"Authorization": f"Bearer {parent_token}"}

    # Create task with an end time in the PAST (00:01 AM)
    t_res = client.post("/api/v1/tasks", json={
        "name": "Early Morning Medicine",
        "category": "Medicine",
        "parentId": parent_id,
        "time": "12:01 AM",
        "endTime": "12:05 AM"  # Has ended for today
    }, headers=child_headers)
    assert t_res.status_code == 201

    # Get instance ID
    sched = client.get(f"/api/v1/task-instances/parent/{parent_id}/today").json()
    inst_id = sched[0]["id"]
    assert sched[0]["is_ended"] is True

    # 1. Parent attempts to complete the ended task -> MUST BE REJECTED
    parent_comp = client.post(f"/api/v1/task-instances/{inst_id}/complete", headers=parent_headers)
    assert parent_comp.status_code == 400
    assert "ended" in parent_comp.json()["detail"].lower()

    # 2. Child completes the ended task -> MUST SUCCEED
    child_comp = client.post(f"/api/v1/task-instances/{inst_id}/complete", headers=child_headers)
    assert child_comp.status_code == 200
    assert child_comp.json()["status"] == "completed"

def test_multi_parent_completion_status_preservation_and_selective_complete(client: TestClient):
    reg = client.post("/api/v1/auth/register", json={
        "email": "perparent@example.com",
        "password": "password123",
        "full_name": "Per Parent Tester",
        "role": "child"
    })
    child_token = reg.json()["access_token"]
    child_headers = {"Authorization": f"Bearer {child_token}"}

    # Create Mom and Dad
    mom = client.post("/api/v1/parents", json={"name": "Mom", "relationship": "Mom"}, headers=child_headers).json()["id"]
    dad = client.post("/api/v1/parents", json={"name": "Dad", "relationship": "Dad"}, headers=child_headers).json()["id"]

    # 1. Create task assigned to Mom
    task_res = client.post("/api/v1/tasks", json={
        "name": "Morning Walk",
        "category": "Exercise",
        "parent_ids": [mom],
        "time": "08:00 AM",
    }, headers=child_headers)
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # 2. Mom completes the task
    mom_sched = client.get(f"/api/v1/task-instances/parent/{mom}/today").json()
    mom_inst_id = mom_sched[0]["id"]
    comp_res = client.post(f"/api/v1/task-instances/{mom_inst_id}/complete", headers=child_headers)
    assert comp_res.status_code == 200
    mom_comp_time = comp_res.json()["completed_time"]
    assert mom_comp_time is not None

    # Check task status: completed for Mom, overall completed
    t_get = client.get(f"/api/v1/tasks/{task_id}", headers=child_headers).json()
    assert t_get["status"] == "completed"
    assert len(t_get["parent_statuses"]) == 1
    assert t_get["parent_statuses"][0]["parent_id"] == mom
    assert t_get["parent_statuses"][0]["status"] == "completed"
    assert t_get["parent_statuses"][0]["completed_time"] == mom_comp_time

    # 3. Child adds Dad to the task
    upd_res = client.put(f"/api/v1/tasks/{task_id}", json={
        "parent_ids": [mom, dad]
    }, headers=child_headers)
    assert upd_res.status_code == 200

    # 4. Check tasks list: Mom MUST STILL be completed, Dad pending, overall pending
    list_res = client.get("/api/v1/tasks", headers=child_headers).json()
    task_item = [t for t in list_res if t["id"] == task_id][0]
    assert task_item["status"] == "pending"  # because Dad hasn't completed it yet
    statuses = {s["parent_id"]: s for s in task_item["parent_statuses"]}
    assert statuses[mom]["status"] == "completed"
    assert statuses[mom]["completed_time"] == mom_comp_time
    assert statuses[dad]["status"] == "pending"
    assert statuses[dad]["completed_time"] is None

    # 5. Admin selectively completes for Dad
    selective_comp = client.post(f"/api/v1/tasks/{task_id}/complete", json={
        "parent_ids": [dad]
    }, headers=child_headers)
    assert selective_comp.status_code == 200

    # 6. Now both Mom and Dad are completed, and overall task is completed!
    final_res = client.get(f"/api/v1/tasks/{task_id}", headers=child_headers).json()
    assert final_res["status"] == "completed"
    final_statuses = {s["parent_id"]: s for s in final_res["parent_statuses"]}
    assert final_statuses[mom]["status"] == "completed"
    assert final_statuses[mom]["completed_time"] == mom_comp_time
    assert final_statuses[dad]["status"] == "completed"
    assert final_statuses[dad]["completed_time"] is not None

