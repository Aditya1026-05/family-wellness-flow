from fastapi.testclient import TestClient

def test_authorization_and_alerts(client: TestClient):
    # Unauthenticated access to /parents should fail
    unauth_res = client.get("/api/v1/parents")
    assert unauth_res.status_code == 401

    # Unauthenticated access to /tasks should fail
    unauth_tasks = client.get("/api/v1/tasks")
    assert unauth_tasks.status_code == 401

    # Register child
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "guardian@example.com",
        "password": "password123",
        "full_name": "Guardian",
        "role": "child"
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Now /parents works
    auth_parents = client.get("/api/v1/parents", headers=headers)
    assert auth_parents.status_code == 200

    # /alerts works
    alerts_res = client.get("/api/v1/alerts", headers=headers)
    assert alerts_res.status_code == 200
    assert isinstance(alerts_res.json(), list)
