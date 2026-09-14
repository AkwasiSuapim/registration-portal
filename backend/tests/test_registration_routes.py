"""
Integration tests for the /registrations/* draft wizard API (PHASE C)
and the Public Safety in-person requirement (PHASE E).
"""

import pytest
from app.database import SessionLocal
from app.models.application import Application
from app.models.student import Student

DEMO_PASSWORD = "Password123!"
DEMO_STUDENT_EMAIL = "jdoe@student.livingstone.edu"
SECOND_STUDENT_EMAIL = "asmith@student.livingstone.edu"

VALID_COURSES = [
    {"course_code": "MAT 231", "course_title": "Calculus I", "section": "01", "credit_hours": 4},
    {"course_code": "CIS 201", "course_title": "Intro to Programming", "section": "01", "credit_hours": 3},
    {"course_code": "ENG 131", "course_title": "College Writing", "section": "02", "credit_hours": 3},
    {"course_code": "HIS 232", "course_title": "African History II", "section": "01", "credit_hours": 3},
    {"course_code": "BIO 101", "course_title": "General Biology", "section": "01", "credit_hours": 4},
]

TEST_TERM = "TEST-PHASEC"
TEST_YEAR = "TEST-PC"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, email, password=DEMO_PASSWORD):
    resp = client.post("/auth/login", json={"identifier": email, "password": password})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _cleanup_drafts_and_test_term(email):
    db = SessionLocal()
    try:
        student = db.query(Student).filter_by(livingstone_email=email).first()
        if student:
            apps = db.query(Application).filter(
                Application.student_id == student.id,
                (Application.overall_status == "draft") | (Application.term_code == TEST_TERM),
            ).all()
            for app in apps:
                db.delete(app)
            db.commit()
    finally:
        db.close()


@pytest.fixture
def student_token(client):
    _cleanup_drafts_and_test_term(DEMO_STUDENT_EMAIL)
    yield _login(client, DEMO_STUDENT_EMAIL)
    _cleanup_drafts_and_test_term(DEMO_STUDENT_EMAIL)


class TestDraftLifecycle:
    def test_no_draft_returns_404(self, client, student_token):
        resp = client.get("/registrations/current", headers=_auth(student_token))
        assert resp.status_code == 404

    def test_start_registration_creates_draft(self, client, student_token):
        resp = client.post("/registrations/", headers=_auth(student_token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["overall_status"] == "draft"
        assert body["clearances"] == []

    def test_start_registration_is_idempotent(self, client, student_token):
        first = client.post("/registrations/", headers=_auth(student_token)).json()
        second = client.post("/registrations/", headers=_auth(student_token)).json()
        assert first["id"] == second["id"]

    def test_get_current_returns_the_draft(self, client, student_token):
        created = client.post("/registrations/", headers=_auth(student_token)).json()
        resp = client.get("/registrations/current", headers=_auth(student_token))
        assert resp.status_code == 200
        assert resp.json()["id"] == created["id"]

    def test_save_section_stores_free_form_data(self, client, student_token):
        draft = client.post("/registrations/", headers=_auth(student_token)).json()
        resp = client.patch(
            f"/registrations/{draft['id']}/sections/welcome_desk",
            headers=_auth(student_token),
            json={"data": {"fullName": "Jane Doe", "phone": "555-0100"}},
        )
        assert resp.status_code == 200
        assert resp.json()["section_data"]["welcome_desk"]["fullName"] == "Jane Doe"

    def test_save_success_center_writes_real_columns(self, client, student_token):
        draft = client.post("/registrations/", headers=_auth(student_token)).json()
        resp = client.patch(
            f"/registrations/{draft['id']}/sections/success_center",
            headers=_auth(student_token),
            json={"data": {
                "major": "Biology", "classification": "Freshman",
                "term_code": TEST_TERM, "academic_year": TEST_YEAR,
                "courses": VALID_COURSES,
            }},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["major"] == "Biology"
        assert body["classification"] == "Freshman"
        assert len(body["courses"]) == len(VALID_COURSES)
        # major/classification are real columns, not duplicated into section_data
        assert "major" not in body["section_data"].get("success_center", {})

    def test_unknown_section_returns_404(self, client, student_token):
        draft = client.post("/registrations/", headers=_auth(student_token)).json()
        resp = client.patch(
            f"/registrations/{draft['id']}/sections/not_a_real_section",
            headers=_auth(student_token),
            json={"data": {}},
        )
        assert resp.status_code == 404

    def test_submit_without_required_fields_returns_422(self, client, student_token):
        draft = client.post("/registrations/", headers=_auth(student_token)).json()
        resp = client.post(f"/registrations/{draft['id']}/submit", headers=_auth(student_token))
        assert resp.status_code == 422

    def test_student_cannot_access_another_students_draft(self, client, student_token):
        draft = client.post("/registrations/", headers=_auth(student_token)).json()
        other_token = _login(client, SECOND_STUDENT_EMAIL)
        resp = client.get(f"/registrations/{draft['id']}/clearances", headers=_auth(other_token))
        assert resp.status_code == 404
        resp2 = client.patch(
            f"/registrations/{draft['id']}/sections/welcome_desk",
            headers=_auth(other_token), json={"data": {}},
        )
        assert resp2.status_code == 404


class TestSubmitAndPublicSafety:
    @pytest.fixture
    def submitted_registration(self, client, student_token):
        draft = client.post("/registrations/", headers=_auth(student_token)).json()
        client.patch(
            f"/registrations/{draft['id']}/sections/success_center",
            headers=_auth(student_token),
            json={"data": {
                "major": "Biology", "classification": "Freshman",
                "term_code": TEST_TERM, "academic_year": TEST_YEAR,
                "courses": VALID_COURSES,
            }},
        )
        client.patch(
            f"/registrations/{draft['id']}/sections/residence_life",
            headers=_auth(student_token),
            json={"data": {"housing_required": True}},
        )
        resp = client.post(f"/registrations/{draft['id']}/submit", headers=_auth(student_token))
        assert resp.status_code == 200, resp.json()
        return resp.json()

    def test_submit_creates_seven_clearances(self, client, submitted_registration):
        assert len(submitted_registration["application"]["clearances"]) == 7

    def test_submit_returns_public_safety_instruction(self, client, submitted_registration):
        instruction = submitted_registration["public_safety_instruction"]
        assert instruction is not None
        assert instruction["office"] == "PUBLIC_SAFETY"
        assert instruction["status"] == "in_person_required"

    def test_public_safety_clearance_starts_in_person_required(self, client, submitted_registration):
        clearances = submitted_registration["application"]["clearances"]
        public_safety = next(c for c in clearances if c["clearance_key"] == "public_safety")
        assert public_safety["status"] == "in_person_required"
        assert public_safety["availability"] == "locked"

    def test_registration_appears_in_history_not_as_draft(self, client, student_token, submitted_registration):
        history_resp = client.get("/registrations/history", headers=_auth(student_token))
        assert history_resp.status_code == 200
        ids = [a["id"] for a in history_resp.json()]
        assert submitted_registration["application"]["id"] in ids

        current_resp = client.get("/registrations/current", headers=_auth(student_token))
        assert current_resp.status_code == 404  # no draft left open

    def test_submit_twice_returns_409(self, client, student_token, submitted_registration):
        app_id = submitted_registration["application"]["id"]
        resp = client.post(f"/registrations/{app_id}/submit", headers=_auth(student_token))
        assert resp.status_code == 409

    def test_clearances_endpoint_shows_instruction_until_approved(self, client, student_token, submitted_registration):
        app_id = submitted_registration["application"]["id"]
        resp = client.get(f"/registrations/{app_id}/clearances", headers=_auth(student_token))
        assert resp.status_code == 200
        assert resp.json()["public_safety_instruction"] is not None
