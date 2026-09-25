from fastapi.testclient import TestClient

def test_child_registration_and_login(client: TestClient):
    # 1. Register new child
    reg_payload = {
        "email": "testchild@example.com",
        "password": "secretpassword123",
        "full_name": "Test Child",
        "role": "child"
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "testchild@example.com"
    assert data["user"]["role"] == "child"

    # 2. Duplicate registration should fail
    dup_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 400

    # 3. Successful login
    login_res = client.post("/api/v1/auth/login", json={
        "email": "testchild@example.com",
        "password": "secretpassword123"
    })
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # 4. Access protected me route
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "testchild@example.com"

    # 5. Invalid credentials login should fail
    fail_res = client.post("/api/v1/auth/login", json={
        "email": "testchild@example.com",
        "password": "wrongpassword"
    })
    assert fail_res.status_code == 401
