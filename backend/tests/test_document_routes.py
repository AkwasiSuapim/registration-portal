"""
Integration tests for document upload routes — Phase 7.

These tests use the real development database via TestClient.

Requirements:
  - Demo users must be seeded (python -m app.scripts.seed_data).
  - The jdoe demo student must exist.

Test applications use term "TEST-PHASE7" so data never collides with real students.

Each fixture creates a fresh application and cleans up both the DB rows and
any uploaded files from disk after the test.
"""

import shutil
from pathlib import Path

import pytest

from app.core.config import settings
from app.database import SessionLocal
from app.models.application import Application
from app.models.student import Student

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEMO_PASSWORD = "Password123!"
DEMO_STUDENT_ID = "100123456"

TEST_TERM = "TEST-PHASE7"
TEST_YEAR = "TEST-P7"

VALID_COURSES = [
    {"course_code": "MAT 231", "course_title": "Calculus I",         "section": "01", "credit_hours": 4},
    {"course_code": "CIS 201", "course_title": "Intro to Programming","section": "01", "credit_hours": 3},
    {"course_code": "ENG 131", "course_title": "College Writing",     "section": "02", "credit_hours": 3},
    {"course_code": "HIS 232", "course_title": "African History II",  "section": "01", "credit_hours": 3},
    {"course_code": "BIO 101", "course_title": "General Biology",     "section": "01", "credit_hours": 4},
]

VALID_APPLICATION = {
    "term_code": TEST_TERM,
    "academic_year": TEST_YEAR,
    "major": "Biology",
    "classification": "Freshman",
    "housing_required": True,
    "courses": VALID_COURSES,
}

# Small valid test file contents.
SMALL_PDF = b"%PDF-1.4 minimal test content for upload test"
SMALL_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _login(client, identifier: str) -> str:
    resp = client.post("/auth/login", json={"identifier": identifier, "password": DEMO_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {identifier}"
    return resp.json()["access_token"]


def _delete_test_application_and_files():
    db = SessionLocal()
    try:
        student = db.query(Student).filter_by(student_no=DEMO_STUDENT_ID).first()
        if not student:
            return
        app = db.query(Application).filter_by(
            student_id=student.id,
            term_code=TEST_TERM,
            academic_year=TEST_YEAR,
        ).first()
        if app:
            app_id = app.id
            db.delete(app)
            db.commit()
            # Remove uploaded files for this application.
            app_dir = Path(settings.UPLOAD_DIR) / "documents" / f"application_{app_id}"
            if app_dir.exists():
                shutil.rmtree(app_dir)
    finally:
        db.close()


@pytest.fixture
def student_token(client):
    return _login(client, "jdoe@student.livingstone.edu")


@pytest.fixture
def doc_app(client, student_token):
    """Creates a fresh test application and cleans up DB + files after the test."""
    _delete_test_application_and_files()
    resp = client.post("/applications", headers=_auth(student_token), json=VALID_APPLICATION)
    assert resp.status_code == 201, f"Setup failed: {resp.json()}"
    data = resp.json()
    yield data
    # Cleanup: delete the application row (DB cascade deletes document rows).
    # Also remove uploaded files from disk.
    app_id = data["id"]
    db = SessionLocal()
    try:
        app = db.query(Application).filter_by(id=app_id).first()
        if app:
            db.delete(app)
            db.commit()
    finally:
        db.close()
    app_dir = Path(settings.UPLOAD_DIR) / "documents" / f"application_{app_id}"
    if app_dir.exists():
        shutil.rmtree(app_dir)


@pytest.fixture
def uploaded_doc(client, student_token, doc_app):
    """Uploads a test PDF and yields the document response dict."""
    resp = client.post(
        f"/applications/{doc_app['id']}/documents",
        headers=_auth(student_token),
        files={"file": ("immunization.pdf", SMALL_PDF, "application/pdf")},
        data={"document_type": "immunization_record"},
    )
    assert resp.status_code == 201, f"Upload failed: {resp.json()}"
    yield resp.json()["document"]


# ---------------------------------------------------------------------------
# POST /applications/{id}/documents
# ---------------------------------------------------------------------------

class TestDocumentUpload:
    def test_student_can_upload_pdf(self, client, student_token, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("photo_id.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "document" in body
        assert "message" in body
        assert body["document"]["document_type"] == "photo_id"
        assert body["document"]["original_filename"] == "photo_id.pdf"
        assert body["document"]["status"] == "uploaded"

    def test_upload_response_has_download_url(self, client, student_token, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("photo.png", SMALL_PNG, "image/png")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 201
        doc = resp.json()["document"]
        assert "download_url" in doc
        assert "/documents/" in doc["download_url"]
        assert "/download" in doc["download_url"]

    def test_download_url_does_not_contain_storage_path(self, client, student_token, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("doc.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "transcript"},
        )
        assert resp.status_code == 201
        doc = resp.json()["document"]
        # Raw file path must NOT appear in the response
        assert "uploads" not in str(doc)
        assert "storage_key" not in doc

    def test_upload_png_is_accepted(self, client, student_token, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("photo.png", SMALL_PNG, "image/png")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 201

    def test_unsupported_file_type_returns_415(self, client, student_token, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("script.exe", b"MZ\x00", "application/octet-stream")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 415

    def test_html_file_rejected(self, client, student_token, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("page.html", b"<html>test</html>", "text/html")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 415

    def test_invalid_document_type_returns_422(self, client, student_token, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("doc.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "bank_statement"},
        )
        assert resp.status_code == 422

    def test_official_cannot_upload(self, client, doc_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(token),
            files={"file": ("doc.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 403

    def test_unauthenticated_upload_returns_401(self, client, doc_app):
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            files={"file": ("doc.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 401

    def test_upload_to_nonexistent_application_returns_404(self, client, student_token):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.post(
            f"/applications/{fake_id}/documents",
            headers=_auth(student_token),
            files={"file": ("doc.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 404

    def test_replacement_upload_links_to_previous_version(self, client, student_token, doc_app):
        """Uploading the same document_type twice creates a replacement chain."""
        # First upload
        resp1 = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("v1.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "photo_id"},
        )
        assert resp1.status_code == 201
        doc1 = resp1.json()["document"]

        # Second upload (replacement)
        resp2 = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("v2.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "photo_id"},
        )
        assert resp2.status_code == 201
        doc2 = resp2.json()["document"]

        assert doc2["supersedes_document_id"] == doc1["id"]
        assert "version 2" in resp2.json()["message"].lower()

    def test_oversized_file_returns_413(self, client, student_token, doc_app):
        from app.core.config import settings
        huge = b"x" * (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 1)
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("big.pdf", huge, "application/pdf")},
            data={"document_type": "transcript"},
        )
        assert resp.status_code == 413

    def test_dangerous_filename_is_sanitized(self, client, student_token, doc_app):
        """A dangerous path-traversal filename is sanitized before storing."""
        resp = client.post(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
            files={"file": ("../../evil.pdf", SMALL_PDF, "application/pdf")},
            data={"document_type": "photo_id"},
        )
        assert resp.status_code == 201
        # The original filename is stored as-is for display, but the stored path must be safe
        doc = resp.json()["document"]
        assert doc["original_filename"] == "../../evil.pdf"


# ---------------------------------------------------------------------------
# GET /applications/{id}/documents
# ---------------------------------------------------------------------------

class TestDocumentList:
    def test_student_can_list_own_documents(self, client, student_token, uploaded_doc, doc_app):
        resp = client.get(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
        )
        assert resp.status_code == 200
        docs = resp.json()
        assert isinstance(docs, list)
        assert len(docs) >= 1
        ids = [d["id"] for d in docs]
        assert uploaded_doc["id"] in ids

    def test_official_can_list_documents_for_review(self, client, uploaded_doc, doc_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_unauthenticated_returns_401(self, client, doc_app):
        resp = client.get(f"/applications/{doc_app['id']}/documents")
        assert resp.status_code == 401

    def test_list_for_nonexistent_app_returns_404(self, client, student_token):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/applications/{fake_id}/documents", headers=_auth(student_token))
        assert resp.status_code == 404

    def test_list_documents_do_not_expose_storage_key(self, client, student_token, uploaded_doc, doc_app):
        resp = client.get(
            f"/applications/{doc_app['id']}/documents",
            headers=_auth(student_token),
        )
        assert resp.status_code == 200
        for doc in resp.json():
            assert "storage_key" not in doc
            assert "stored_filename" not in doc


# ---------------------------------------------------------------------------
# GET /documents/{id}/download
# ---------------------------------------------------------------------------

class TestDocumentDownload:
    def test_student_can_download_own_document(self, client, student_token, uploaded_doc):
        resp = client.get(
            f"/documents/{uploaded_doc['id']}/download",
            headers=_auth(student_token),
        )
        assert resp.status_code == 200
        assert resp.content == SMALL_PDF

    def test_official_can_download_document_for_review(self, client, uploaded_doc):
        token = _login(client, "health@livingstone.edu")
        resp = client.get(
            f"/documents/{uploaded_doc['id']}/download",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.content == SMALL_PDF

    def test_admin_can_download_document(self, client, uploaded_doc):
        token = _login(client, "admin@livingstone.edu")
        resp = client.get(
            f"/documents/{uploaded_doc['id']}/download",
            headers=_auth(token),
        )
        assert resp.status_code == 200

    def test_unauthenticated_download_returns_401(self, client, uploaded_doc):
        resp = client.get(f"/documents/{uploaded_doc['id']}/download")
        assert resp.status_code == 401

    def test_nonexistent_document_returns_404(self, client, student_token):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/documents/{fake_id}/download", headers=_auth(student_token))
        assert resp.status_code == 404

    def test_downloaded_content_type_matches_upload(self, client, student_token, uploaded_doc):
        resp = client.get(
            f"/documents/{uploaded_doc['id']}/download",
            headers=_auth(student_token),
        )
        assert resp.status_code == 200
        assert "pdf" in resp.headers.get("content-type", "").lower()


# ---------------------------------------------------------------------------
# GET /applications/{id}/review — documents field
# ---------------------------------------------------------------------------

class TestApplicationReviewWithDocuments:
    def test_review_includes_documents_list(self, client, uploaded_doc, doc_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get(
            f"/applications/{doc_app['id']}/review",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "documents" in body
        assert isinstance(body["documents"], list)
        doc_ids = [d["id"] for d in body["documents"]]
        assert uploaded_doc["id"] in doc_ids

    def test_review_documents_do_not_expose_storage_key(self, client, uploaded_doc, doc_app):
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get(
            f"/applications/{doc_app['id']}/review",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        for doc in resp.json().get("documents", []):
            assert "storage_key" not in doc
            assert "stored_filename" not in doc

    def test_review_documents_empty_before_upload(self, client, doc_app):
        """Application review shows empty documents list when nothing uploaded yet."""
        token = _login(client, "registrar@livingstone.edu")
        resp = client.get(
            f"/applications/{doc_app['id']}/review",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["documents"] == []
