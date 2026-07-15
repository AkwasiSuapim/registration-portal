"""
Integration tests for application routes.

These tests use the real development database via TestClient.
Requirements:
  - Demo users must be seeded (python -m app.scripts.seed_data).
  - Tests create and then delete their own data, so the database is left clean.

The submitted_application fixture uses a distinct term_code ("TEST-FALL-2026")
so test data never collides with real student data.
"""

import pytest
from app.database import SessionLocal
from app.models.application import Application
from app.models.student import Student

# ---------------------------------------------------------------------------
# Test constants
# ---------------------------------------------------------------------------

DEMO_STUDENT_ID = "100123456"
DEMO_STUDENT_EMAIL = "jdoe@student.livingstone.edu"
DEMO_PASSWORD = "Password123!"

TEST_TERM = "TEST-FALL-2026"
TEST_YEAR = "TEST-2026"   # String(9) max in the model

VALID_COURSES = [
    {"course_code": "MAT 231", "course_title": "Calculus I",                    "section": "01", "credit_hours": 4},
    {"course_code": "CIS 201", "course_title": "Intro to Programming",          "section": "01", "credit_hours": 3},
    {"course_code": "ENG 131", "course_title": "College Writing",               "section": "02", "credit_hours": 3},
    {"course_code": "HIS 232", "course_title": "African American History II",   "section": "01", "credit_hours": 3},
    {"course_code": "BIO 101", "course_title": "General Biology",               "section": "01", "credit_hours": 4},
]

VALID_APPLICATION = {
    "term_code": TEST_TERM,
    "academic_year": TEST_YEAR,
    "major": "Mathematics",
    "classification": "Freshman",
    "housing_required": True,
    "courses": VALID_COURSES,
}


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def student_token(client):
    resp = client.post("/auth/login", json={"identifier": DEMO_STUDENT_ID, "password": DEMO_PASSWORD})
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _delete_test_application():
    """Removes any leftover test application from a previous interrupted run."""
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
def submitted_application(client, student_token):
    """
    Submits a fresh test application and deletes it after each test.
    Pre-cleans any leftover from a prior interrupted run.
    """
    _delete_test_application()

    resp = client.post("/applications", headers=_auth(student_token), json=VALID_APPLICATION)
    assert resp.status_code == 201, f"Setup failed: {resp.json()}"
    data = resp.json()

    yield data, student_token

    # Cleanup: delete the application so the next test can create a fresh one.
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
# POST /applications
# ---------------------------------------------------------------------------

class TestSubmitApplication:
    def test_valid_application_returns_201(self, client, student_token):
        _delete_test_application()
        resp = client.post("/applications", headers=_auth(student_token), json=VALID_APPLICATION)
        assert resp.status_code == 201
        # cleanup
        app_id = resp.json().get("id")
        if app_id:
            db = SessionLocal()
            try:
                app = db.query(Application).filter_by(id=app_id).first()
                if app:
                    db.delete(app)
                    db.commit()
            finally:
                db.close()

    def test_response_contains_expected_fields(self, submitted_application):
        data, _ = submitted_application
        assert "id" in data
        assert "application_number" in data
        assert "overall_status" in data
        assert "courses" in data
        assert "clearances" in data
        assert data["overall_status"] == "in_progress"

    def test_application_has_seven_clearances(self, submitted_application):
        data, _ = submitted_application
        assert len(data["clearances"]) == 7

    def test_registrar_clearance_is_ready(self, submitted_application):
        data, _ = submitted_application
        registrar = next(c for c in data["clearances"] if c["clearance_key"] == "registrar_check_in")
        assert registrar["availability"] == "ready"
        assert registrar["status"] == "pending"

    def test_downstream_clearances_are_locked(self, submitted_application):
        data, _ = submitted_application
        locked_keys = {"health_services", "success_center", "financial_aid", "business_office"}
        for c in data["clearances"]:
            if c["clearance_key"] in locked_keys:
                assert c["availability"] == "locked", f"{c['clearance_key']} should be locked"

    def test_residence_life_is_required_for_residential(self, submitted_application):
        data, _ = submitted_application
        rl = next(c for c in data["clearances"] if c["clearance_key"] == "residence_life")
        assert rl["is_required"] is True
        assert rl["availability"] == "locked"

    def test_total_credit_hours_computed_correctly(self, submitted_application):
        data, _ = submitted_application
        assert data["total_credit_hours"] == 17.0

    def test_courses_are_saved(self, submitted_application):
        data, _ = submitted_application
        assert len(data["courses"]) == 5

    def test_below_15_credits_returns_422(self, client, student_token):
        _delete_test_application()
        resp = client.post("/applications", headers=_auth(student_token), json={
            **VALID_APPLICATION,
            "courses": [
                {"course_code": "MAT 101", "course_title": "Math", "section": "01", "credit_hours": 3},
                {"course_code": "ENG 101", "course_title": "English", "section": "01", "credit_hours": 3},
            ],
        })
        assert resp.status_code == 422
        assert "15" in resp.json()["detail"]

    def test_exactly_15_credits_is_accepted(self, client, student_token):
        _delete_test_application()
        resp = client.post("/applications", headers=_auth(student_token), json={
            **VALID_APPLICATION,
            "courses": [
                {"course_code": "MAT 101", "course_title": "Math I",    "section": "01", "credit_hours": 5},
                {"course_code": "ENG 101", "course_title": "English I", "section": "01", "credit_hours": 5},
                {"course_code": "HIS 101", "course_title": "History I", "section": "01", "credit_hours": 5},
            ],
        })
        assert resp.status_code == 201
        app_id = resp.json().get("id")
        if app_id:
            db = SessionLocal()
            try:
                app = db.query(Application).filter_by(id=app_id).first()
                if app:
                    db.delete(app)
                    db.commit()
            finally:
                db.close()

    def test_duplicate_same_term_returns_409(self, client, student_token, submitted_application):
        # submitted_application already created one application for TEST_TERM.
        resp = client.post("/applications", headers=_auth(student_token), json=VALID_APPLICATION)
        assert resp.status_code == 409
        assert "already have" in resp.json()["detail"].lower()

    def test_empty_courses_list_returns_422(self, client, student_token):
        _delete_test_application()
        resp = client.post("/applications", headers=_auth(student_token), json={
            **VALID_APPLICATION,
            "courses": [],
        })
        assert resp.status_code == 422

    def test_zero_credit_hours_returns_422(self, client, student_token):
        _delete_test_application()
        resp = client.post("/applications", headers=_auth(student_token), json={
            **VALID_APPLICATION,
            "courses": [{"course_code": "MAT 101", "course_title": "Math", "credit_hours": 0}],
        })
        assert resp.status_code == 422

    def test_unauthenticated_request_returns_401(self, client):
        resp = client.post("/applications", json=VALID_APPLICATION)
        assert resp.status_code == 401

    def test_commuter_residence_life_is_not_required(self, client, student_token):
        _delete_test_application()
        resp = client.post("/applications", headers=_auth(student_token), json={
            **VALID_APPLICATION,
            "housing_required": False,
        })
        assert resp.status_code == 201
        data = resp.json()
        rl = next(c for c in data["clearances"] if c["clearance_key"] == "residence_life")
        assert rl["is_required"] is False
        assert rl["status"] == "not_required"
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


# ---------------------------------------------------------------------------
# GET /students/me/applications
# ---------------------------------------------------------------------------

class TestGetMyApplications:
    def test_returns_list(self, client, student_token, submitted_application):
        resp = client.get("/students/me/applications", headers=_auth(student_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_includes_submitted_application(self, client, student_token, submitted_application):
        data, _ = submitted_application
        resp = client.get("/students/me/applications", headers=_auth(student_token))
        ids = [a["id"] for a in resp.json()]
        assert data["id"] in ids

    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/students/me/applications")
        assert resp.status_code == 401

    def test_official_cannot_use_student_endpoint(self, client):
        login = client.post("/auth/login", json={
            "identifier": "registrar@livingstone.edu",
            "password": DEMO_PASSWORD,
        })
        token = login.json()["access_token"]
        resp = client.get("/students/me/applications", headers=_auth(token))
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /applications/{id}
# ---------------------------------------------------------------------------

class TestGetApplicationById:
    def test_student_can_access_own_application(self, client, student_token, submitted_application):
        data, _ = submitted_application
        resp = client.get(f"/applications/{data['id']}", headers=_auth(student_token))
        assert resp.status_code == 200
        assert resp.json()["id"] == data["id"]

    def test_student_cannot_access_nonexistent_application(self, client, student_token):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/applications/{fake_id}", headers=_auth(student_token))
        assert resp.status_code == 404

    def test_official_can_read_application(self, client, submitted_application):
        data, _ = submitted_application
        login = client.post("/auth/login", json={
            "identifier": "registrar@livingstone.edu",
            "password": DEMO_PASSWORD,
        })
        token = login.json()["access_token"]
        resp = client.get(f"/applications/{data['id']}", headers=_auth(token))
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /applications/{id}/status
# ---------------------------------------------------------------------------

class TestGetApplicationStatus:
    def test_returns_status_response(self, client, student_token, submitted_application):
        data, _ = submitted_application
        resp = client.get(f"/applications/{data['id']}/status", headers=_auth(student_token))
        assert resp.status_code == 200
        body = resp.json()
        assert "application_id" in body
        assert "overall_status" in body
        assert "clearances" in body
        assert body["overall_status"] == "in_progress"

    def test_status_has_seven_clearances(self, client, student_token, submitted_application):
        data, _ = submitted_application
        resp = client.get(f"/applications/{data['id']}/status", headers=_auth(student_token))
        assert len(resp.json()["clearances"]) == 7

    def test_unauthenticated_returns_401(self, client, submitted_application):
        data, _ = submitted_application
        resp = client.get(f"/applications/{data['id']}/status")
        assert resp.status_code == 401
