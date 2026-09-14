"""
Integration tests for the admin routes (PHASE A + PHASE B).

Hits the real development database via TestClient, same convention as
the other route test files. Every row created here is cleaned up in a
fixture teardown so re-running the suite never collides with itself.
"""

import random

import pytest
from sqlalchemy import text

from app.database import SessionLocal
from app.models.official import Official
from app.models.student import Student
from app.models.user import User

DEMO_PASSWORD = "Password123!"
ADMIN_EMAIL = "admin@livingstone.edu"
DEMO_STUDENT_EMAIL = "jdoe@student.livingstone.edu"
DEMO_OFFICIAL_EMAIL = "registrar@livingstone.edu"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, identifier, password=DEMO_PASSWORD):
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, f"Login failed for {identifier}: {resp.json()}"
    return resp.json()["access_token"]


def _random_student_id() -> str:
    return "100" + f"{random.randint(0, 999999):06d}"


def _delete_user_by_email(email: str) -> None:
    """
    Raw SQL on purpose: db.delete(User) via the ORM tries to null the
    Student/Official row's NOT NULL user_id FK before deleting (default
    relationship cascade behavior), which violates the constraint. A raw
    DELETE lets Postgres' own ON DELETE CASCADE (see the FKs on
    students.user_id / officials.user_id) do the right thing.
    """
    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM users WHERE email = :email"), {"email": email})
        db.commit()
    finally:
        db.close()


@pytest.fixture
def admin_token(client):
    return _login(client, ADMIN_EMAIL)


# ---------------------------------------------------------------------------
# PHASE B — account creation
# ---------------------------------------------------------------------------

class TestAdminCreatesStudent:
    def test_admin_can_create_student(self, client, admin_token):
        student_id = _random_student_id()
        email = f"testauto.{student_id}@student.livingstone.edu"
        try:
            resp = client.post(
                "/admin/users/students",
                headers=_auth(admin_token),
                json={
                    "student_id": student_id,
                    "first_name": "Test",
                    "last_name": "Automation",
                    "school_email": email,
                    "classification": "Freshman",
                    "major": "Computer Science",
                    "residency_type": "commuter",
                },
            )
            assert resp.status_code == 201, resp.json()
            body = resp.json()
            assert body["account_type"] == "student"
            assert "temporary_password" in body and len(body["temporary_password"]) >= 8

            # The new account can actually log in with the returned temp password.
            login_resp = client.post("/auth/login", json={
                "identifier": student_id, "password": body["temporary_password"],
            })
            assert login_resp.status_code == 200
            assert login_resp.json()["user"]["account_type"] == "student"
            assert login_resp.json()["user"]["must_change_password"] is True
        finally:
            _delete_user_by_email(email)

    def test_duplicate_student_id_returns_409(self, client, admin_token):
        resp = client.post(
            "/admin/users/students",
            headers=_auth(admin_token),
            json={
                "student_id": "100123456",  # demo jdoe
                "first_name": "Dup", "last_name": "Licate",
                "school_email": "someoneelse@student.livingstone.edu",
            },
        )
        assert resp.status_code == 409

    def test_invalid_student_email_domain_returns_422(self, client, admin_token):
        resp = client.post(
            "/admin/users/students",
            headers=_auth(admin_token),
            json={
                "student_id": _random_student_id(),
                "first_name": "Bad", "last_name": "Email",
                "school_email": "notastudent@gmail.com",
            },
        )
        assert resp.status_code == 422

    def test_student_cannot_create_student(self, client):
        token = _login(client, DEMO_STUDENT_EMAIL)
        resp = client.post(
            "/admin/users/students", headers=_auth(token),
            json={
                "student_id": _random_student_id(),
                "first_name": "No", "last_name": "Access",
                "school_email": "noaccess@student.livingstone.edu",
            },
        )
        assert resp.status_code == 403

    def test_official_cannot_create_student(self, client):
        token = _login(client, DEMO_OFFICIAL_EMAIL)
        resp = client.post(
            "/admin/users/students", headers=_auth(token),
            json={
                "student_id": _random_student_id(),
                "first_name": "No", "last_name": "Access",
                "school_email": "noaccess2@student.livingstone.edu",
            },
        )
        assert resp.status_code == 403


class TestAdminCreatesOfficial:
    def test_admin_can_create_official(self, client, admin_token):
        suffix = random.randint(100000, 999999)
        email = f"testauto{suffix}@livingstone.edu"
        try:
            resp = client.post(
                "/admin/users/officials",
                headers=_auth(admin_token),
                json={
                    "first_name": "Test", "last_name": "Official",
                    "school_email": email,
                    "primary_office": "FINANCIAL_AID",
                },
            )
            assert resp.status_code == 201, resp.json()
            body = resp.json()
            assert body["account_type"] == "official"

            login_resp = client.post("/auth/login", json={
                "identifier": email, "password": body["temporary_password"],
            })
            assert login_resp.status_code == 200
            assert login_resp.json()["user"]["role_key"] == "financial_aid"
        finally:
            _delete_user_by_email(email)

    def test_official_must_have_exactly_one_canonical_office(self, client, admin_token):
        suffix = random.randint(100000, 999999)
        resp = client.post(
            "/admin/users/officials",
            headers=_auth(admin_token),
            json={
                "first_name": "Bad", "last_name": "Office",
                "school_email": f"badoffice{suffix}@livingstone.edu",
                "primary_office": "NOT_A_REAL_OFFICE",
            },
        )
        assert resp.status_code == 422

    def test_admin_cannot_create_admin(self, client, admin_token):
        """
        There is no field on either creation endpoint that can produce an
        admin account: POST /admin/users/students always creates
        account_type='student' and POST /admin/users/officials always
        creates account_type='official' with a role drawn only from the
        seven-office OfficeKey enum (which has no admin/system_admin
        value) — role escalation is structurally impossible, not just
        blocked by a check. This test proves office="SYSTEM_ADMIN" (or
        any non-office string) is rejected outright.
        """
        suffix = random.randint(100000, 999999)
        resp = client.post(
            "/admin/users/officials",
            headers=_auth(admin_token),
            json={
                "first_name": "Would", "last_name": "BeAdmin",
                "school_email": f"wouldbeadmin{suffix}@livingstone.edu",
                "primary_office": "SYSTEM_ADMIN",
            },
        )
        assert resp.status_code == 422
        # And there is no endpoint at all for creating an admin account.
        openapi = client.get("/openapi.json").json()
        assert "/admin/users/admins" not in openapi["paths"]


# ---------------------------------------------------------------------------
# PHASE B — activate / deactivate / login gating
# ---------------------------------------------------------------------------

class TestActivateDeactivate:
    @pytest.fixture
    def new_student(self, client, admin_token):
        student_id = _random_student_id()
        email = f"activatetest.{student_id}@student.livingstone.edu"
        resp = client.post(
            "/admin/users/students", headers=_auth(admin_token),
            json={
                "student_id": student_id, "first_name": "Active", "last_name": "Test",
                "school_email": email,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        yield {"student_id": student_id, "email": email, "user_id": body["user_id"], "password": body["temporary_password"]}
        _delete_user_by_email(email)

    def test_deactivated_user_cannot_login(self, client, admin_token, new_student):
        resp = client.post(
            f"/admin/users/{new_student['user_id']}/deactivate", headers=_auth(admin_token)
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

        login_resp = client.post("/auth/login", json={
            "identifier": new_student["student_id"], "password": new_student["password"],
        })
        assert login_resp.status_code == 401

    def test_reactivated_user_can_login_again(self, client, admin_token, new_student):
        client.post(f"/admin/users/{new_student['user_id']}/deactivate", headers=_auth(admin_token))
        resp = client.post(f"/admin/users/{new_student['user_id']}/activate", headers=_auth(admin_token))
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

        login_resp = client.post("/auth/login", json={
            "identifier": new_student["student_id"], "password": new_student["password"],
        })
        assert login_resp.status_code == 200

    def test_admin_cannot_deactivate_own_account(self, client, admin_token):
        me = client.get("/auth/me", headers=_auth(admin_token)).json()
        resp = client.post(f"/admin/users/{me['id']}/deactivate", headers=_auth(admin_token))
        assert resp.status_code == 400


class TestUserListing:
    def test_list_users_requires_admin(self, client):
        token = _login(client, DEMO_OFFICIAL_EMAIL)
        resp = client.get("/officials/me/queue" if False else "/admin/users", headers=_auth(token))
        assert resp.status_code == 403

    def test_list_users_returns_no_password_fields(self, client, admin_token):
        resp = client.get("/admin/users", headers=_auth(admin_token))
        assert resp.status_code == 200
        assert "password" not in resp.text.lower() and "password_hash" not in resp.text

    def test_list_users_search_by_student_id(self, client, admin_token):
        resp = client.get("/admin/users", headers=_auth(admin_token), params={"search": "100123456"})
        assert resp.status_code == 200
        body = resp.json()
        assert any(item["id_number"] == "100123456" for item in body["items"])

    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/admin/users")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PHASE B — office reassignment
# ---------------------------------------------------------------------------

class TestOfficeReassignment:
    def test_admin_can_reassign_official_office(self, client, admin_token):
        db = SessionLocal()
        try:
            official = db.query(Official).filter_by(staff_email=DEMO_OFFICIAL_EMAIL).first()
            official_id = str(official.id)
        finally:
            db.close()

        resp = client.put(
            f"/admin/officials/{official_id}/office",
            headers=_auth(admin_token),
            json={"office": "SUCCESS_CENTER"},
        )
        assert resp.status_code == 200
        assert resp.json()["office"] == "SUCCESS_CENTER"

        login_resp = client.post("/auth/login", json={
            "identifier": DEMO_OFFICIAL_EMAIL, "password": DEMO_PASSWORD,
        })
        assert login_resp.json()["user"]["role_key"] == "success_center"

        # restore for other tests / demo data
        resp = client.put(
            f"/admin/officials/{official_id}/office",
            headers=_auth(admin_token),
            json={"office": "REGISTRAR"},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# PHASE A — dashboard summary
# ---------------------------------------------------------------------------

class TestDashboardSummary:
    def test_dashboard_summary_returns_real_counts(self, client, admin_token):
        resp = client.get("/admin/dashboard/summary", headers=_auth(admin_token))
        assert resp.status_code == 200
        body = resp.json()
        for key in (
            "total_students", "active_officials", "registrations_in_progress",
            "completed_registrations", "blocked_applications", "pending_clearances",
        ):
            assert isinstance(body[key], int)
        assert body["total_students"] >= 4  # at least the four seeded demo students
        assert len(body["registration_progress_by_office"]) == 7
        assert isinstance(body["recent_activity"], list)
        assert isinstance(body["applications_requiring_attention"], list)

    def test_dashboard_summary_requires_admin(self, client):
        token = _login(client, DEMO_OFFICIAL_EMAIL)
        resp = client.get("/admin/dashboard/summary", headers=_auth(token))
        assert resp.status_code == 403

    def test_dashboard_summary_unauthenticated_returns_401(self, client):
        resp = client.get("/admin/dashboard/summary")
        assert resp.status_code == 401
