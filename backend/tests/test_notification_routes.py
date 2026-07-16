"""
Integration tests for notification routes — Phase 8.

Uses the real development database via TestClient.
Demo users must be seeded (python -m app.scripts.seed_data).

Test applications use term "TEST-PHASE8" to avoid colliding with real data.

Notification creation is triggered by the normal application workflow:
  1. Submit application → Registrar role receives a role notification.
  2. Registrar approves registrar_check_in → Student receives a user notification
     AND Health Services role receives a role notification.
"""

import pytest

from app.database import SessionLocal
from app.models.application import Application
from app.models.student import Student

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEMO_PASSWORD = "Password123!"
TEST_TERM = "TEST-PHASE8"
TEST_YEAR = "TEST-P8"

VALID_APPLICATION = {
    "term_code": TEST_TERM,
    "academic_year": TEST_YEAR,
    "major": "Computer Science",
    "classification": "Sophomore",
    "housing_required": True,
    "courses": [
        {"course_code": "CIS 301", "course_title": "Data Structures",    "section": "01", "credit_hours": 3},
        {"course_code": "MAT 201", "course_title": "Discrete Math",       "section": "01", "credit_hours": 3},
        {"course_code": "ENG 131", "course_title": "College Writing",     "section": "02", "credit_hours": 3},
        {"course_code": "HIS 101", "course_title": "World History",       "section": "01", "credit_hours": 3},
        {"course_code": "PHY 201", "course_title": "Physics I",           "section": "01", "credit_hours": 4},
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
    """Submits a test application and deletes it (+ cascade notifications) after the test."""
    _delete_test_application()
    resp = client.post("/applications", headers=_auth(student_token), json=VALID_APPLICATION)
    assert resp.status_code == 201, f"Application submission failed: {resp.json()}"
    data = resp.json()
    yield data
    _delete_test_application()


@pytest.fixture
def registrar_approved_app(client, student_token, submitted_app):
    """
    Submits a test application and then approves the registrar clearance,
    triggering notifications for both the student and Health Services.
    """
    # Find the registrar clearance ID
    registrar_token = _login(client, "registrar@livingstone.edu")
    queue_resp = client.get(
        "/officials/me/queue",
        headers=_auth(registrar_token),
        params={"availability": "ready"},
    )
    assert queue_resp.status_code == 200
    items = queue_resp.json()
    our_app_items = [i for i in items if i["application_id"] == submitted_app["id"]]
    assert our_app_items, "Test application not found in registrar queue."
    clearance_id = our_app_items[0]["clearance_id"]

    # Approve it
    patch_resp = client.patch(
        f"/clearances/{clearance_id}",
        headers=_auth(registrar_token),
        json={"action": "approve"},
    )
    assert patch_resp.status_code == 200, f"Clearance approval failed: {patch_resp.json()}"
    yield submitted_app


# ---------------------------------------------------------------------------
# GET /notifications
# ---------------------------------------------------------------------------

class TestListNotifications:
    def test_unauthenticated_returns_401(self, client, submitted_app):
        resp = client.get("/notifications")
        assert resp.status_code == 401

    def test_authenticated_returns_200(self, client, student_token, submitted_app):
        resp = client.get("/notifications", headers=_auth(student_token))
        assert resp.status_code == 200

    def test_response_has_required_fields(self, client, student_token, submitted_app):
        resp = client.get("/notifications", headers=_auth(student_token))
        body = resp.json()
        assert "notifications" in body
        assert "unread_count" in body
        assert "total_count" in body

    def test_student_has_no_notifications_for_submitted_app(
        self, client, student_token, submitted_app
    ):
        # Submission creates only a ROLE notification for the registrar, not a student notification.
        # Use limit=200 so we can check all notifications regardless of prior test data.
        resp = client.get("/notifications", headers=_auth(student_token), params={"limit": 200})
        assert resp.status_code == 200
        body = resp.json()
        app_notifs = [
            n for n in body["notifications"]
            if n.get("application_id") == submitted_app["id"]
        ]
        assert len(app_notifs) == 0

    def test_registrar_has_role_notification_after_submission(self, client, submitted_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get("/notifications", headers=_auth(token))
        assert resp.status_code == 200
        body = resp.json()
        # The test application submission should have created at least one notification
        # for the registrar role (application_submitted event).
        app_notifications = [
            n for n in body["notifications"]
            if n.get("application_id") == submitted_app["id"]
        ]
        assert len(app_notifications) >= 1

    def test_student_cannot_see_registrar_role_notification(self, client, student_token, submitted_app):
        resp = client.get("/notifications", headers=_auth(student_token), params={"limit": 200})
        body = resp.json()
        # Student should see 0 notifications for THIS application (submission only notifies the registrar role)
        app_notifs = [
            n for n in body["notifications"]
            if n.get("application_id") == submitted_app["id"]
        ]
        assert len(app_notifs) == 0

    def test_student_sees_own_notification_after_clearance_approved(
        self, client, student_token, registrar_approved_app
    ):
        resp = client.get("/notifications", headers=_auth(student_token))
        assert resp.status_code == 200
        body = resp.json()
        app_notifications = [
            n for n in body["notifications"]
            if n.get("application_id") == registrar_approved_app["id"]
        ]
        assert len(app_notifications) >= 1

    def test_health_official_sees_role_notification_after_registrar_approval(
        self, client, registrar_approved_app
    ):
        token = _login(client, "health@livingstone.edu")
        resp = client.get("/notifications", headers=_auth(token))
        assert resp.status_code == 200
        body = resp.json()
        app_notifications = [
            n for n in body["notifications"]
            if n.get("application_id") == registrar_approved_app["id"]
        ]
        assert len(app_notifications) >= 1

    def test_business_office_has_no_notification_until_financial_aid_approves(
        self, client, registrar_approved_app
    ):
        # business_office depends on financial_aid, not registrar_check_in.
        # So it should NOT receive a notification when only registrar_check_in is approved.
        token = _login(client, "businessoffice@livingstone.edu")
        resp = client.get("/notifications", headers=_auth(token))
        assert resp.status_code == 200
        body = resp.json()
        app_notifications = [
            n for n in body["notifications"]
            if n.get("application_id") == registrar_approved_app["id"]
        ]
        assert len(app_notifications) == 0

    def test_unread_only_filter_works(self, client, student_token, registrar_approved_app):
        resp = client.get(
            "/notifications",
            headers=_auth(student_token),
            params={"unread_only": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        for n in body["notifications"]:
            assert not n["is_read"]

    def test_notification_fields_are_present(self, client, registrar_approved_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get("/notifications", headers=_auth(token))
        assert resp.status_code == 200
        notifications = resp.json()["notifications"]
        if notifications:
            n = notifications[0]
            assert "id" in n
            assert "title" in n
            assert "body" in n
            assert "is_read" in n
            assert "created_at" in n
            assert "event_type" in n

    def test_limit_query_param_respected(self, client, registrar_approved_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get(
            "/notifications",
            headers=_auth(token),
            params={"limit": 1},
        )
        assert resp.status_code == 200
        assert len(resp.json()["notifications"]) <= 1


# ---------------------------------------------------------------------------
# GET /notifications/unread-count
# ---------------------------------------------------------------------------

class TestUnreadCount:
    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/notifications/unread-count")
        assert resp.status_code == 401

    def test_returns_count_fields(self, client, student_token, submitted_app):
        resp = client.get("/notifications/unread-count", headers=_auth(student_token))
        assert resp.status_code == 200
        body = resp.json()
        assert "unread_count" in body
        assert "total_count" in body

    def test_student_has_no_app_notifications_before_approval(self, client, student_token, submitted_app):
        # Check via list endpoint — unread-count covers ALL of jdoe's history, so we
        # filter by application_id to isolate this specific application.
        resp = client.get("/notifications", headers=_auth(student_token), params={"limit": 200})
        app_notifs = [
            n for n in resp.json()["notifications"]
            if n.get("application_id") == submitted_app["id"]
        ]
        assert len(app_notifs) == 0

    def test_student_unread_count_nonzero_after_approval(
        self, client, student_token, registrar_approved_app
    ):
        resp = client.get("/notifications/unread-count", headers=_auth(student_token))
        assert resp.json()["unread_count"] >= 1

    def test_total_count_gte_unread_count(self, client, student_token, registrar_approved_app):
        resp = client.get("/notifications/unread-count", headers=_auth(student_token))
        body = resp.json()
        assert body["total_count"] >= body["unread_count"]


# ---------------------------------------------------------------------------
# PATCH /notifications/{id}/read
# ---------------------------------------------------------------------------

class TestMarkOneRead:
    def test_unauthenticated_returns_401(self, client, registrar_approved_app):
        # Use a fake ID — we only care about the 401, not the 404
        fake_id = "00000000-0000-0000-0000-000000000001"
        resp = client.patch(f"/notifications/{fake_id}/read")
        assert resp.status_code == 401

    def test_mark_own_notification_as_read(self, client, student_token, registrar_approved_app):
        # Get the student's notifications
        list_resp = client.get("/notifications", headers=_auth(student_token))
        notifications = list_resp.json()["notifications"]
        app_notifs = [
            n for n in notifications
            if n.get("application_id") == registrar_approved_app["id"]
        ]
        assert app_notifs, "Student should have at least one notification after registrar approval."
        notif_id = app_notifs[0]["id"]

        # Mark it read
        resp = client.patch(f"/notifications/{notif_id}/read", headers=_auth(student_token))
        assert resp.status_code == 200
        body = resp.json()
        assert "notification" in body
        assert "message" in body
        assert body["notification"]["is_read"] is True
        assert body["notification"]["read_at"] is not None

    def test_mark_nonexistent_notification_returns_404(self, client, student_token, submitted_app):
        fake_id = "00000000-0000-0000-0000-000000000002"
        resp = client.patch(f"/notifications/{fake_id}/read", headers=_auth(student_token))
        assert resp.status_code == 404

    def test_mark_is_idempotent(self, client, student_token, registrar_approved_app):
        list_resp = client.get("/notifications", headers=_auth(student_token))
        notifications = list_resp.json()["notifications"]
        app_notifs = [
            n for n in notifications
            if n.get("application_id") == registrar_approved_app["id"]
        ]
        assert app_notifs
        notif_id = app_notifs[0]["id"]

        resp1 = client.patch(f"/notifications/{notif_id}/read", headers=_auth(student_token))
        resp2 = client.patch(f"/notifications/{notif_id}/read", headers=_auth(student_token))
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp2.json()["notification"]["is_read"] is True

    def test_student_cannot_mark_registrar_role_notification(self, client, student_token, submitted_app):
        # Get registrar role notification for this application
        reg_token = _login(client, "registrar@livingstone.edu")
        list_resp = client.get("/notifications", headers=_auth(reg_token))
        notifications = list_resp.json()["notifications"]
        app_notifs = [
            n for n in notifications
            if n.get("application_id") == submitted_app["id"]
        ]
        if not app_notifs:
            pytest.skip("No registrar notification found for this test application.")
        notif_id = app_notifs[0]["id"]

        # Student tries to mark it — should get 404
        resp = client.patch(f"/notifications/{notif_id}/read", headers=_auth(student_token))
        assert resp.status_code == 404

    def test_unread_count_decreases_after_mark_read(self, client, student_token, registrar_approved_app):
        count_before = client.get("/notifications/unread-count", headers=_auth(student_token)).json()

        list_resp = client.get("/notifications", headers=_auth(student_token))
        app_notifs = [
            n for n in list_resp.json()["notifications"]
            if n.get("application_id") == registrar_approved_app["id"] and not n["is_read"]
        ]
        if not app_notifs:
            pytest.skip("No unread student notification found.")
        notif_id = app_notifs[0]["id"]
        client.patch(f"/notifications/{notif_id}/read", headers=_auth(student_token))

        count_after = client.get("/notifications/unread-count", headers=_auth(student_token)).json()
        assert count_after["unread_count"] == count_before["unread_count"] - 1


# ---------------------------------------------------------------------------
# PATCH /notifications/read-all
# ---------------------------------------------------------------------------

class TestMarkAllRead:
    def test_unauthenticated_returns_401(self, client):
        resp = client.patch("/notifications/read-all")
        assert resp.status_code == 401

    def test_returns_marked_count(self, client, student_token, registrar_approved_app):
        resp = client.patch("/notifications/read-all", headers=_auth(student_token))
        assert resp.status_code == 200
        body = resp.json()
        assert "marked_read_count" in body
        assert "message" in body

    def test_marks_all_student_notifications_as_read(self, client, student_token, registrar_approved_app):
        client.patch("/notifications/read-all", headers=_auth(student_token))
        count_resp = client.get("/notifications/unread-count", headers=_auth(student_token))
        assert count_resp.json()["unread_count"] == 0

    def test_returns_zero_when_already_all_read(self, client, student_token, registrar_approved_app):
        # Mark all read once
        client.patch("/notifications/read-all", headers=_auth(student_token))
        # Then call again
        resp = client.patch("/notifications/read-all", headers=_auth(student_token))
        assert resp.json()["marked_read_count"] == 0

    def test_does_not_mark_other_users_notifications(self, client, student_token, submitted_app):
        # Registrar role notification exists; student calls read-all.
        client.patch("/notifications/read-all", headers=_auth(student_token))
        # Registrar should still see their notification as unread.
        reg_token = _login(client, "registrar@livingstone.edu")
        reg_resp = client.get("/notifications", headers=_auth(reg_token))
        app_notifs = [
            n for n in reg_resp.json()["notifications"]
            if n.get("application_id") == submitted_app["id"]
        ]
        # The registrar role notification should still be unread
        unread = [n for n in app_notifs if not n["is_read"]]
        assert len(unread) >= 1
