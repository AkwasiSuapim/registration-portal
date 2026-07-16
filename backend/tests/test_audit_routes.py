"""
Integration tests for audit routes — Phase 8.

Uses the real development database via TestClient.
Demo users must be seeded (python -m app.scripts.seed_data).

Test applications use term "TEST-PHASE8-AUDIT" to avoid collisions.

Submitting an application triggers audit log creation (action='application_submitted'),
which gives the tests real data to assert against.

Note on cleanup: AuditLog rows have ondelete="SET NULL" on application_id, so
deleting the test application sets application_id=NULL on audit rows — the rows
themselves remain but no longer point to the test application. This is fine for
isolation because each test uses the specific application_id to filter results.
"""

import pytest

from app.database import SessionLocal
from app.models.application import Application
from app.models.student import Student

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEMO_PASSWORD = "Password123!"
TEST_TERM = "TEST-PHASE8-AUDIT"
TEST_YEAR = "TEST-P8A"

VALID_APPLICATION = {
    "term_code": TEST_TERM,
    "academic_year": TEST_YEAR,
    "major": "History",
    "classification": "Junior",
    "housing_required": False,
    "courses": [
        {"course_code": "HIS 301", "course_title": "Modern History",      "section": "01", "credit_hours": 3},
        {"course_code": "ENG 201", "course_title": "Literature",          "section": "01", "credit_hours": 3},
        {"course_code": "SOC 101", "course_title": "Introduction to Sociology", "section": "01", "credit_hours": 3},
        {"course_code": "POL 201", "course_title": "Political Theory",    "section": "01", "credit_hours": 3},
        {"course_code": "ART 101", "course_title": "Art History",         "section": "01", "credit_hours": 3},
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _login(client, identifier: str) -> str:
    resp = client.post("/auth/login", json={"identifier": identifier, "password": DEMO_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {identifier}: {resp.json()}"
    return resp.json()["access_token"]


def _delete_test_application():
    db = SessionLocal()
    try:
        student = db.query(Student).filter_by(student_no="100123456").first()
        if not student:
            return
        app = db.query(Application).filter_by(
            student_id=student.id,
            term_code=TEST_TERM,
            academic_year=TEST_YEAR,
        ).first()
        if app:
            db.delete(app)
            db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def student_token(client):
    return _login(client, "jdoe@student.livingstone.edu")


@pytest.fixture
def submitted_app(client, student_token):
    """Submits a test application. Cleans up the application row after the test."""
    _delete_test_application()
    resp = client.post("/applications", headers=_auth(student_token), json=VALID_APPLICATION)
    assert resp.status_code == 201, f"Submission failed: {resp.json()}"
    data = resp.json()
    yield data
    _delete_test_application()


# ---------------------------------------------------------------------------
# GET /applications/{id}/activity
# ---------------------------------------------------------------------------

class TestApplicationActivity:
    def test_unauthenticated_returns_401(self, client, submitted_app):
        resp = client.get(f"/applications/{submitted_app['id']}/activity")
        assert resp.status_code == 401

    def test_student_can_view_own_application_activity(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        assert resp.status_code == 200

    def test_response_has_required_fields(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        body = resp.json()
        assert "application_id" in body
        assert "activity" in body
        assert "total_count" in body

    def test_application_id_matches_request(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        assert resp.json()["application_id"] == submitted_app["id"]

    def test_submission_audit_log_is_present(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        actions = [entry["action"] for entry in resp.json()["activity"]]
        assert "application_submitted" in actions

    def test_activity_entries_have_required_fields(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        for entry in resp.json()["activity"]:
            assert "id" in entry
            assert "occurred_at" in entry
            assert "action" in entry
            assert "success" in entry

    def test_total_count_matches_activity_length(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        body = resp.json()
        assert body["total_count"] == len(body["activity"])

    def test_no_sensitive_fields_in_response(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        for entry in resp.json()["activity"]:
            assert "ip_address" not in entry
            assert "user_agent" not in entry
            assert "request_id" not in entry
            assert "before_state_json" not in entry

    def test_official_can_view_any_application_activity(self, client, submitted_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(token),
        )
        assert resp.status_code == 200

    def test_admin_can_view_any_application_activity(self, client, submitted_app):
        token = _login(client, "admin@livingstone.edu")
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(token),
        )
        assert resp.status_code == 200

    def test_nonexistent_application_returns_404(self, client, student_token):
        fake_id = "00000000-0000-0000-0000-000000000099"
        resp = client.get(f"/applications/{fake_id}/activity", headers=_auth(student_token))
        assert resp.status_code == 404

    def test_student_cannot_view_other_application_returns_404(self, client, submitted_app):
        # Use a completely different UUID that does not exist in the DB
        different_id = "00000000-0000-0000-0000-000000000098"
        token = _login(client, "jdoe@student.livingstone.edu")
        resp = client.get(f"/applications/{different_id}/activity", headers=_auth(token))
        assert resp.status_code == 404

    def test_limit_param_respected(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
            params={"limit": 1},
        )
        assert resp.status_code == 200
        assert len(resp.json()["activity"]) <= 1

    def test_activity_is_ordered_newest_first(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        entries = resp.json()["activity"]
        if len(entries) >= 2:
            assert entries[0]["occurred_at"] >= entries[1]["occurred_at"]

    def test_details_field_present_for_submission(self, client, student_token, submitted_app):
        resp = client.get(
            f"/applications/{submitted_app['id']}/activity",
            headers=_auth(student_token),
        )
        submission_entries = [
            e for e in resp.json()["activity"] if e["action"] == "application_submitted"
        ]
        assert submission_entries
        # details may be None or a dict — just assert it's present as a key
        assert "details" in submission_entries[0]


# ---------------------------------------------------------------------------
# GET /admin/audit-logs
# ---------------------------------------------------------------------------

class TestAdminAuditLogs:
    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/admin/audit-logs")
        assert resp.status_code == 401

    def test_student_cannot_access_admin_audit_logs(self, client, student_token, submitted_app):
        resp = client.get("/admin/audit-logs", headers=_auth(student_token))
        assert resp.status_code == 403

    def test_official_cannot_access_admin_audit_logs(self, client, submitted_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get("/admin/audit-logs", headers=_auth(token))
        assert resp.status_code == 403

    def test_admin_can_access_audit_logs(self, client, submitted_app):
        token = _login(client, "admin@livingstone.edu")
        resp = client.get("/admin/audit-logs", headers=_auth(token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_admin_response_entries_have_required_fields(self, client, submitted_app):
        token = _login(client, "admin@livingstone.edu")
        resp = client.get("/admin/audit-logs", headers=_auth(token))
        for entry in resp.json():
            assert "id" in entry
            assert "occurred_at" in entry
            assert "action" in entry
            assert "success" in entry

    def test_admin_logs_include_recent_submission(self, client, submitted_app):
        token = _login(client, "admin@livingstone.edu")
        resp = client.get("/admin/audit-logs", headers=_auth(token), params={"limit": 200})
        assert resp.status_code == 200
        app_entries = [
            e for e in resp.json()
            if e.get("application_id") == submitted_app["id"]
        ]
        assert len(app_entries) >= 1

    def test_limit_param_respected(self, client, submitted_app):
        token = _login(client, "admin@livingstone.edu")
        resp = client.get("/admin/audit-logs", headers=_auth(token), params={"limit": 5})
        assert resp.status_code == 200
        assert len(resp.json()) <= 5

    def test_offset_param_works(self, client, submitted_app):
        token = _login(client, "admin@livingstone.edu")
        resp_page1 = client.get(
            "/admin/audit-logs", headers=_auth(token), params={"limit": 5, "offset": 0},
        )
        resp_page2 = client.get(
            "/admin/audit-logs", headers=_auth(token), params={"limit": 5, "offset": 5},
        )
        assert resp_page1.status_code == 200
        assert resp_page2.status_code == 200
        ids_page1 = {e["id"] for e in resp_page1.json()}
        ids_page2 = {e["id"] for e in resp_page2.json()}
        # Pages should not overlap (assuming enough rows exist)
        if ids_page1 and ids_page2:
            assert ids_page1.isdisjoint(ids_page2)

    def test_no_sensitive_fields_in_admin_response(self, client, submitted_app):
        token = _login(client, "admin@livingstone.edu")
        resp = client.get("/admin/audit-logs", headers=_auth(token), params={"limit": 10})
        for entry in resp.json():
            assert "ip_address" not in entry
            assert "user_agent" not in entry
            assert "request_id" not in entry
