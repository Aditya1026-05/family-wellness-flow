from fastapi.testclient import TestClient

def test_qr_invite_generation_and_linking(client: TestClient):
    # Register child
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "son@example.com",
        "password": "password123",
        "full_name": "Son",
        "role": "child"
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create parent profile (e.g. Mom)
    parent_res = client.post("/api/v1/parents", json={
        "name": "Mom",
        "relationship": "Mom",
        "color": "peach"
    }, headers=headers)
    assert parent_res.status_code == 201
    parent_data = parent_res.json()
    assert parent_data["name"] == "Mom"
    assert "invite_token" in parent_data
    invite_token = parent_data["invite_token"]

    # Parent scans QR / accepts invite
    accept_res = client.post("/api/v1/invites/accept", json={
        "code": invite_token
    })
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert "access_token" in accept_data
    assert accept_data["parent_name"] == "Mom"
    assert accept_data["relationship"] == "Mom"

    # Single-use validation: attempting to reuse same invite must fail
    reuse_res = client.post("/api/v1/invites/accept", json={
        "code": invite_token
    })
    assert reuse_res.status_code == 400
    assert "already been used" in reuse_res.json()["detail"].lower()

def test_short_code_linking(client: TestClient):
    # Register child
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "daughter@example.com",
        "password": "password123",
        "full_name": "Daughter",
        "role": "child"
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create parent profile (e.g. Dad)
    parent_res = client.post("/api/v1/parents", json={
        "name": "Dad",
        "relationship": "Dad",
        "color": "mint"
    }, headers=headers)
    assert parent_res.status_code == 201
    parent_data = parent_res.json()
    assert "short_code" in parent_data
    short_code = parent_data["short_code"]
    assert len(short_code) == 6

    # Test get parent invite endpoint
    pid = parent_data["id"]
    invite_res = client.get(f"/api/v1/parents/{pid}/invite", headers=headers)
    assert invite_res.status_code == 200
    invite_info = invite_res.json()
    assert invite_info["code"] == short_code

    # Parent manually types 6-character short code (in lowercase or uppercase)
    accept_res = client.post("/api/v1/invites/accept", json={
        "code": short_code.lower()
    })
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["parent_name"] == "Dad"
    assert accept_data["relationship"] == "Dad"
