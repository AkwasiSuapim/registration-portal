"""
Integration tests for the official clearance workflow — Phase 6.

These tests hit the real development database via TestClient.

Requirements:
  - Demo users must be seeded (python -m app.scripts.seed_data).
  - The jdoe demo student must exist.

Each test class manages its own application fixture so test data stays isolated.
The test term "TEST-PHASE6" is used so records never collide with real student data.
"""

import pytest
from app.database import SessionLocal
from app.models.application import Application
from app.models.clearance import Clearance
from app.models.student import Student

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEMO_PASSWORD = "Password123!"
DEMO_STUDENT_ID = "100123456"

TEST_TERM = "TEST-PHASE6"
TEST_YEAR = "TEST-P6"

VALID_COURSES = [
    {"course_code": "MAT 231", "course_title": "Calculus I",         "section": "01", "credit_hours": 4},
    {"course_code": "CIS 201", "course_title": "Intro to Programming","section": "01", "credit_hours": 3},
    {"course_code": "ENG 131", "course_title": "College Writing",     "section": "02", "credit_hours": 3},
    {"course_code": "HIS 232", "course_title": "African History II",  "section": "01", "credit_hours": 3},
    {"course_code": "BIO 101", "course_title": "General Biology",     "section": "01", "credit_hours": 4},
]

RESIDENTIAL_APPLICATION = {
    "term_code": TEST_TERM,
    "academic_year": TEST_YEAR,
    "major": "Biology",
    "classification": "Freshman",
    "housing_required": True,
    "courses": VALID_COURSES,
}

COMMUTER_APPLICATION = {
    **RESIDENTIAL_APPLICATION,
    "housing_required": False,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, email):
    resp = client.post("/auth/login", json={"identifier": email, "password": DEMO_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.json()}"
    return resp.json()["access_token"]


def _clearance_id(app_data, key):
    """Returns the clearance ID for the given clearance_key from an application response."""
    return next(c["id"] for c in app_data["clearances"] if c["clearance_key"] == key)


def _delete_test_application():
    db = SessionLocal()
    try:
        student = db.query(Student).filter_by(student_no=DEMO_STUDENT_ID).first()
        if student:
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


@pytest.fixture
def student_token(client):
    return _login(client, "jdoe@student.livingstone.edu")


@pytest.fixture
def workflow_app(client, student_token):
    """Submits a fresh residential test application and deletes it after the test."""
    _delete_test_application()
    resp = client.post(
        "/applications", headers=_auth(student_token), json=RESIDENTIAL_APPLICATION
    )
    assert resp.status_code == 201, f"Setup failed: {resp.json()}"
    data = resp.json()
    yield data
    # cleanup
    app_id = data.get("id")
    if app_id:
        db = SessionLocal()
        try:
            app = db.query(Application).filter_by(id=app_id).first()
            if app:
                db.delete(app)
                db.commit()
        finally:
            db.close()


@pytest.fixture
def commuter_app(client, student_token):
    """Submits a fresh commuter test application and deletes it after the test."""
    _delete_test_application()
    resp = client.post(
        "/applications", headers=_auth(student_token), json=COMMUTER_APPLICATION
    )
    assert resp.status_code == 201, f"Setup failed: {resp.json()}"
    data = resp.json()
    yield data
    app_id = data.get("id")
    if app_id:
        db = SessionLocal()
        try:
            app = db.query(Application).filter_by(id=app_id).first()
            if app:
                db.delete(app)
                db.commit()
        finally:
            db.close()


# ---------------------------------------------------------------------------
# GET /officials/me/queue
# ---------------------------------------------------------------------------

class TestOfficialQueue:
    def test_registrar_queue_returns_list(self, client, workflow_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get("/officials/me/queue", headers=_auth(token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_registrar_queue_contains_ready_clearance(self, client, workflow_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get("/officials/me/queue?availability=ready", headers=_auth(token))
        assert resp.status_code == 200
        items = resp.json()
        keys = [item["clearance_key"] for item in items]
        assert "registrar_check_in" in keys

    def test_queue_item_has_required_fields(self, client, workflow_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get("/officials/me/queue?availability=ready", headers=_auth(token))
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 1
        item = next(i for i in items if i["clearance_key"] == "registrar_check_in")
        assert "application_id" in item
        assert "student_name" in item
        assert "student_no" in item
        assert "clearance_status" in item
        assert "clearance_availability" in item
        assert item["clearance_availability"] == "ready"

    def test_student_cannot_access_queue(self, client, student_token, workflow_app):
        resp = client.get("/officials/me/queue", headers=_auth(student_token))
        assert resp.status_code == 403

    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/officials/me/queue")
        assert resp.status_code == 401

    def test_health_queue_empty_before_registrar_approves(self, client, workflow_app):
        token = _login(client, "health@livingstone.edu")
        resp = client.get("/officials/me/queue?availability=ready", headers=_auth(token))
        assert resp.status_code == 200
        items = resp.json()
        # health clearance is locked; no ready items for this app in health queue
        ready_ids = [i["clearance_id"] for i in items]
        health_clearance_id = _clearance_id(workflow_app, "health_services")
        assert health_clearance_id not in ready_ids


# ---------------------------------------------------------------------------
# GET /applications/{id}/review
# ---------------------------------------------------------------------------

class TestApplicationReview:
    def test_official_can_review_application(self, client, workflow_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get(f"/applications/{workflow_app['id']}/review", headers=_auth(token))
        assert resp.status_code == 200
        body = resp.json()
        assert "student" in body
        assert "first_name" in body["student"]
        assert "courses" in body
        assert "clearances" in body
        assert "total_credit_hours" in body

    def test_student_cannot_access_review_endpoint(self, client, student_token, workflow_app):
        resp = client.get(f"/applications/{workflow_app['id']}/review", headers=_auth(student_token))
        assert resp.status_code == 403

    def test_review_returns_404_for_unknown_id(self, client):
        token = _login(client, "registrar@livingstone.edu")
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/applications/{fake_id}/review", headers=_auth(token))
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /clearances/{id} — access control
# ---------------------------------------------------------------------------

class TestClearanceUpdateAccessControl:
    def test_student_cannot_patch_clearance(self, client, student_token, workflow_app):
        cid = _clearance_id(workflow_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(student_token),
            json={"action": "approve"},
        )
        assert resp.status_code == 403

    def test_wrong_office_cannot_approve_another_offices_clearance(self, client, workflow_app):
        # Health official trying to approve the Registrar clearance
        token = _login(client, "health@livingstone.edu")
        cid = _clearance_id(workflow_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(token),
            json={"action": "approve"},
        )
        assert resp.status_code == 403

    def test_locked_clearance_returns_409(self, client, workflow_app):
        # Financial Aid clearance is locked at this point
        token = _login(client, "financialaid@livingstone.edu")
        cid = _clearance_id(workflow_app, "financial_aid")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(token),
            json={"action": "approve"},
        )
        assert resp.status_code == 409

    def test_nonexistent_clearance_returns_404(self, client):
        token = _login(client, "registrar@livingstone.edu")
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.patch(
            f"/clearances/{fake_id}",
            headers=_auth(token),
            json={"action": "approve"},
        )
        assert resp.status_code == 404

    def test_invalid_action_returns_422(self, client, workflow_app):
        token = _login(client, "registrar@livingstone.edu")
        cid = _clearance_id(workflow_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(token),
            json={"action": "vanish"},
        )
        assert resp.status_code == 422

    def test_request_correction_without_message_returns_422(self, client, workflow_app):
        token = _login(client, "registrar@livingstone.edu")
        cid = _clearance_id(workflow_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(token),
            json={"action": "request_correction"},
        )
        assert resp.status_code == 422

    def test_non_public_safety_cannot_mark_in_person(self, client, workflow_app):
        token = _login(client, "registrar@livingstone.edu")
        cid = _clearance_id(workflow_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(token),
            json={"action": "mark_in_person_required"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /clearances/{id} — workflow: residential path
# ---------------------------------------------------------------------------

class TestResidentialWorkflow:
    def test_full_residential_workflow_reaches_fully_registered(self, client, workflow_app):
        """
        Approves every clearance in order and verifies the full residential
        workflow completes with overall_status == 'fully_registered'.
        """
        app_id = workflow_app["id"]

        # 1. Registrar approves → should unlock health, success_center, financial_aid
        registrar_token = _login(client, "registrar@livingstone.edu")
        cid = _clearance_id(workflow_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(registrar_token),
            json={"action": "approve"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["clearance"]["status"] == "approved"
        assert body["clearance"]["availability"] == "completed"
        unlocked_keys = {c["clearance_key"] for c in body["unlocked_clearances"]}
        assert unlocked_keys == {"health_services", "success_center", "financial_aid"}
        assert body["application_overall_status"] == "in_progress"

        # 2. Health Services approves
        health_token = _login(client, "health@livingstone.edu")
        cid = _clearance_id(workflow_app, "health_services")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(health_token), json={"action": "approve"}
        )
        assert resp.status_code == 200
        assert resp.json()["clearance"]["status"] == "approved"

        # 3. Success Center approves
        success_token = _login(client, "success@livingstone.edu")
        cid = _clearance_id(workflow_app, "success_center")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(success_token), json={"action": "approve"}
        )
        assert resp.status_code == 200

        # 4. Financial Aid approves → should unlock business_office
        fa_token = _login(client, "financialaid@livingstone.edu")
        cid = _clearance_id(workflow_app, "financial_aid")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(fa_token), json={"action": "approve"}
        )
        assert resp.status_code == 200
        unlocked_keys = {c["clearance_key"] for c in resp.json()["unlocked_clearances"]}
        assert "business_office" in unlocked_keys

        # 5. Business Office approves → should unlock residence_life (residential)
        bo_token = _login(client, "businessoffice@livingstone.edu")
        cid = _clearance_id(workflow_app, "business_office")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(bo_token), json={"action": "approve"}
        )
        assert resp.status_code == 200
        unlocked_keys = {c["clearance_key"] for c in resp.json()["unlocked_clearances"]}
        assert "residence_life" in unlocked_keys

        # 6. Residence Life approves → should unlock public_safety
        rl_token = _login(client, "residencelife@livingstone.edu")
        cid = _clearance_id(workflow_app, "residence_life")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(rl_token), json={"action": "approve"}
        )
        assert resp.status_code == 200
        unlocked_keys = {c["clearance_key"] for c in resp.json()["unlocked_clearances"]}
        assert "public_safety" in unlocked_keys

        # 7. Public Safety approves → overall_status becomes fully_registered
        ps_token = _login(client, "publicsafety@livingstone.edu")
        cid = _clearance_id(workflow_app, "public_safety")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(ps_token), json={"action": "approve"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["clearance"]["status"] == "approved"
        assert body["application_overall_status"] == "fully_registered"
        # current_step is set to "fully_registered" sentinel (DB column is NOT NULL)
        assert body["application_current_step"] == "fully_registered"
        assert body["unlocked_clearances"] == []

    def test_approve_already_approved_returns_409(self, client, workflow_app):
        """Once a clearance is approved, trying to approve it again returns 409."""
        registrar_token = _login(client, "registrar@livingstone.edu")
        cid = _clearance_id(workflow_app, "registrar_check_in")
        # First approval
        client.patch(f"/clearances/{cid}", headers=_auth(registrar_token), json={"action": "approve"})
        # Second attempt
        resp = client.patch(f"/clearances/{cid}", headers=_auth(registrar_token), json={"action": "approve"})
        assert resp.status_code == 409

    def test_request_correction_sets_status_and_overall(self, client, workflow_app):
        registrar_token = _login(client, "registrar@livingstone.edu")
        cid = _clearance_id(workflow_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}",
            headers=_auth(registrar_token),
            json={"action": "request_correction", "message": "Please provide updated immunization records."},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["clearance"]["status"] == "correction_required"
        assert body["clearance"]["availability"] == "needs_student_action"
        assert body["clearance"]["message"] == "Please provide updated immunization records."
        assert body["application_overall_status"] == "correction_required"
        # No downstream clearances should unlock
        assert body["unlocked_clearances"] == []


# ---------------------------------------------------------------------------
# PATCH /clearances/{id} — workflow: commuter path
# ---------------------------------------------------------------------------

class TestCommuterWorkflow:
    def test_commuter_workflow_skips_residence_life(self, client, commuter_app):
        """
        For a commuter student, Business Office approval directly unlocks Public Safety
        (Residence Life is not required and should not appear in unlocked_clearances).
        """
        app_id = commuter_app["id"]

        # Approve registrar
        registrar_token = _login(client, "registrar@livingstone.edu")
        cid = _clearance_id(commuter_app, "registrar_check_in")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(registrar_token), json={"action": "approve"}
        )
        assert resp.status_code == 200

        # Approve health, success, financial
        for email, key in [
            ("health@livingstone.edu", "health_services"),
            ("success@livingstone.edu", "success_center"),
            ("financialaid@livingstone.edu", "financial_aid"),
        ]:
            token = _login(client, email)
            cid = _clearance_id(commuter_app, key)
            resp = client.patch(
                f"/clearances/{cid}", headers=_auth(token), json={"action": "approve"}
            )
            assert resp.status_code == 200

        # Business Office approves → should unlock public_safety (not residence_life)
        bo_token = _login(client, "businessoffice@livingstone.edu")
        cid = _clearance_id(commuter_app, "business_office")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(bo_token), json={"action": "approve"}
        )
        assert resp.status_code == 200
        unlocked_keys = {c["clearance_key"] for c in resp.json()["unlocked_clearances"]}
        assert "public_safety" in unlocked_keys
        assert "residence_life" not in unlocked_keys

        # Public Safety approves → fully_registered
        ps_token = _login(client, "publicsafety@livingstone.edu")
        cid = _clearance_id(commuter_app, "public_safety")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(ps_token), json={"action": "approve"}
        )
        assert resp.status_code == 200
        assert resp.json()["application_overall_status"] == "fully_registered"

    def test_residence_life_clearance_is_not_required_for_commuter(self, client, commuter_app):
        """Residence Life cannot be updated for a commuter application."""
        rl_token = _login(client, "residencelife@livingstone.edu")
        cid = _clearance_id(commuter_app, "residence_life")
        resp = client.patch(
            f"/clearances/{cid}", headers=_auth(rl_token), json={"action": "approve"}
        )
        # not_required clearances cannot be updated
        assert resp.status_code == 409
