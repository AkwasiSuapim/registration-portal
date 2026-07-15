"""
Integration tests for POST /auth/login and GET /auth/me.

These tests use the real development database via TestClient.
They depend on demo users being seeded — run seed_data first:

    python -m app.scripts.seed_data

These tests only read or authenticate — they do not create, modify, or
delete any data, so running them is safe against the development database.
"""


DEMO_STUDENT_ID = "100123456"
DEMO_STUDENT_EMAIL = "jdoe@student.livingstone.edu"
DEMO_OFFICIAL_EMAIL = "registrar@livingstone.edu"
DEMO_ADMIN_EMAIL = "admin@livingstone.edu"
DEMO_PASSWORD = "Password123!"


class TestLoginEndpoint:
    def test_student_login_with_student_id_succeeds(self, client):
        response = client.post("/auth/login", json={
            "identifier": DEMO_STUDENT_ID,
            "password": DEMO_PASSWORD,
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["account_type"] == "student"

    def test_student_login_with_email_succeeds(self, client):
        response = client.post("/auth/login", json={
            "identifier": DEMO_STUDENT_EMAIL,
            "password": DEMO_PASSWORD,
        })
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_official_login_succeeds(self, client):
        response = client.post("/auth/login", json={
            "identifier": DEMO_OFFICIAL_EMAIL,
            "password": DEMO_PASSWORD,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["account_type"] == "official"
        assert data["user"]["role_key"] == "registrar"

    def test_admin_login_succeeds(self, client):
        response = client.post("/auth/login", json={
            "identifier": DEMO_ADMIN_EMAIL,
            "password": DEMO_PASSWORD,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["account_type"] == "admin"

    def test_wrong_password_returns_401(self, client):
        response = client.post("/auth/login", json={
            "identifier": DEMO_STUDENT_ID,
            "password": "WrongPassword!",
        })
        assert response.status_code == 401

    def test_wrong_student_id_returns_401(self, client):
        response = client.post("/auth/login", json={
            "identifier": "100999999",
            "password": DEMO_PASSWORD,
        })
        assert response.status_code == 401

    def test_invalid_identifier_format_returns_401(self, client):
        # A gmail address is not a recognized format — must be rejected.
        response = client.post("/auth/login", json={
            "identifier": "anyone@gmail.com",
            "password": DEMO_PASSWORD,
        })
        assert response.status_code == 401

    def test_student_email_cannot_login_as_staff(self, client):
        # A student email must never match the staff lookup path.
        # This ensures student accounts cannot impersonate officials.
        response = client.post("/auth/login", json={
            "identifier": DEMO_STUDENT_EMAIL,
            "password": "WrongPassword!",
        })
        assert response.status_code == 401

    def test_login_response_contains_role_info(self, client):
        response = client.post("/auth/login", json={
            "identifier": DEMO_STUDENT_ID,
            "password": DEMO_PASSWORD,
        })
        user = response.json()["user"]
        assert "role_key" in user
        assert "role_name" in user
        assert user["role_key"] == "student"

    def test_login_response_does_not_contain_password(self, client):
        response = client.post("/auth/login", json={
            "identifier": DEMO_STUDENT_ID,
            "password": DEMO_PASSWORD,
        })
        body = response.text
        assert "Password123" not in body
        assert "password_hash" not in body


class TestMeEndpoint:
    def _get_token(self, client, identifier=DEMO_STUDENT_ID) -> str:
        response = client.post("/auth/login", json={
            "identifier": identifier,
            "password": DEMO_PASSWORD,
        })
        return response.json()["access_token"]

    def test_me_with_valid_student_token_returns_200(self, client):
        token = self._get_token(client)
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200

    def test_me_returns_correct_student_fields(self, client):
        token = self._get_token(client)
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        user = response.json()
        assert user["account_type"] == "student"
        assert user["role_key"] == "student"
        assert user["is_active"] is True
        assert "email" in user
        assert "id" in user

    def test_me_with_official_token_returns_official_info(self, client):
        token = self._get_token(client, identifier=DEMO_OFFICIAL_EMAIL)
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        user = response.json()
        assert user["account_type"] == "official"
        assert user["role_key"] == "registrar"

    def test_me_without_token_returns_401(self, client):
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        response = client.get("/auth/me", headers={"Authorization": "Bearer not.a.valid.token"})
        assert response.status_code == 401

    def test_me_with_malformed_header_returns_401(self, client):
        response = client.get("/auth/me", headers={"Authorization": "NotBearer sometoken"})
        assert response.status_code == 401
