"""
Unit tests for document_service — pure logic only.

No database or HTTP server is used.
SimpleNamespace is used for lightweight fake objects where needed.
"""

import os
import pytest

from app.services.document_service import (
    ALLOWED_DOCUMENT_TYPES,
    sanitize_filename,
    validate_document_type,
    validate_upload,
    _build_storage_key,
)


# ---------------------------------------------------------------------------
# sanitize_filename
# ---------------------------------------------------------------------------

class TestSanitizeFilename:
    def test_removes_directory_traversal(self):
        # os.path.basename strips the full path, so only the last component survives.
        assert sanitize_filename("../../etc/passwd.pdf") == "passwd.pdf"

    def test_removes_leading_dot(self):
        assert sanitize_filename(".hidden.pdf") == "hidden.pdf"

    def test_replaces_spaces(self):
        result = sanitize_filename("my document.pdf")
        assert " " not in result
        assert result.endswith(".pdf")

    def test_keeps_safe_filename_intact(self):
        assert sanitize_filename("immunization.pdf") == "immunization.pdf"

    def test_empty_filename_becomes_unnamed(self):
        assert sanitize_filename("") == "unnamed"

    def test_filename_with_only_dots_becomes_unnamed(self):
        # dots stripped, leaving empty string → unnamed
        result = sanitize_filename("...")
        assert result == "unnamed"

    def test_windows_path_separator_stripped(self):
        result = sanitize_filename("C:\\Users\\student\\file.pdf")
        # os.path.basename handles forward slashes on all platforms
        # The backslash becomes part of the filename on non-Windows, so
        # it's replaced by underscore; the important thing is no slash survives.
        assert "/" not in result
        assert result.endswith(".pdf")

    def test_forward_slash_in_name_stripped(self):
        result = sanitize_filename("folder/evil.pdf")
        assert result == "evil.pdf"

    def test_special_chars_replaced(self):
        result = sanitize_filename("my<>file?.pdf")
        assert "<" not in result
        assert ">" not in result
        assert "?" not in result


# ---------------------------------------------------------------------------
# validate_document_type
# ---------------------------------------------------------------------------

class TestValidateDocumentType:
    def test_photo_id_is_valid(self):
        validate_document_type("photo_id")  # should not raise

    def test_immunization_record_is_valid(self):
        validate_document_type("immunization_record")

    def test_all_allowed_types_are_valid(self):
        for doc_type in ALLOWED_DOCUMENT_TYPES:
            validate_document_type(doc_type)  # none should raise

    def test_unknown_type_raises_422(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_document_type("bank_statement")
        assert exc_info.value.status_code == 422

    def test_empty_string_raises_422(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            validate_document_type("")

    def test_injection_attempt_raises_422(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            validate_document_type("photo_id; DROP TABLE documents;")


# ---------------------------------------------------------------------------
# validate_upload — content type and extension checks
# ---------------------------------------------------------------------------

TINY_PDF = b"%PDF-1.4 test"
TINY_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8

class TestValidateUpload:
    def test_valid_pdf_passes(self):
        validate_upload("report.pdf", "application/pdf", TINY_PDF)

    def test_valid_png_passes(self):
        validate_upload("photo.png", "image/png", TINY_PNG)

    def test_valid_jpeg_passes(self):
        validate_upload("photo.jpg", "image/jpeg", TINY_PNG)

    def test_valid_docx_passes(self):
        validate_upload(
            "form.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            b"PK\x03\x04",  # minimal zip/docx magic
        )

    def test_unsupported_content_type_raises_415(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_upload("script.js", "application/javascript", b"alert(1)")
        assert exc_info.value.status_code == 415

    def test_executable_extension_raises_415(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_upload("evil.exe", "application/pdf", TINY_PDF)
        assert exc_info.value.status_code == 415

    def test_shell_script_extension_raises_415(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_upload("bad.sh", "application/pdf", TINY_PDF)
        assert exc_info.value.status_code == 415

    def test_html_extension_raises_415(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_upload("phish.html", "text/html", b"<html>")
        assert exc_info.value.status_code == 415

    def test_oversized_file_raises_413(self):
        from fastapi import HTTPException
        from app.core.config import settings
        huge = b"x" * (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 1)
        with pytest.raises(HTTPException) as exc_info:
            validate_upload("big.pdf", "application/pdf", huge)
        assert exc_info.value.status_code == 413

    def test_exactly_at_limit_passes(self):
        from app.core.config import settings
        at_limit = b"x" * (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024)
        # Should not raise
        validate_upload("big.pdf", "application/pdf", at_limit)

    def test_content_type_with_charset_is_accepted(self):
        # Some clients send "application/pdf; charset=utf-8"
        validate_upload("report.pdf", "application/pdf; charset=utf-8", TINY_PDF)

    def test_missing_content_type_raises_415(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            validate_upload("file.pdf", "", TINY_PDF)


# ---------------------------------------------------------------------------
# _build_storage_key
# ---------------------------------------------------------------------------

class TestBuildStorageKey:
    def test_key_contains_application_id(self):
        import uuid
        app_id = uuid.uuid4()
        key = _build_storage_key(app_id, "test.pdf")
        assert str(app_id) in key

    def test_key_starts_with_documents_prefix(self):
        import uuid
        key = _build_storage_key(uuid.uuid4(), "test.pdf")
        assert key.startswith("documents/")

    def test_key_contains_sanitized_filename(self):
        import uuid
        key = _build_storage_key(uuid.uuid4(), "report.pdf")
        assert "report.pdf" in key

    def test_two_keys_for_same_file_are_unique(self):
        import uuid
        app_id = uuid.uuid4()
        key1 = _build_storage_key(app_id, "same.pdf")
        key2 = _build_storage_key(app_id, "same.pdf")
        assert key1 != key2
