"""
Document service — file upload, storage, retrieval, and access control.

Storage layout:
  backend/uploads/documents/application_{application_id}/{uuid4}_{safe_filename}

The storage_key stored in the database is the path relative to UPLOAD_DIR:
  documents/application_{application_id}/{uuid4}_{safe_filename}

This keeps cloud migration simple: replace local read/write with S3 get/put
and the database rows stay unchanged.

Security rules enforced here:
  - Extension and content-type are both checked.
  - File size is enforced before writing to disk.
  - Original filenames are sanitized before use in the stored path.
  - The storage_key is validated against the uploads base before returning
    the file path to callers, preventing path-traversal attacks.
  - Raw file paths are never exposed in API responses.
"""

import hashlib
import os
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.application import Application
from app.models.document import Document
from app.models.student import Student
from app.models.user import User
from app.services import audit_service, notification_service

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_DOCUMENT_TYPES = frozenset({
    "photo_id",
    "immunization_record",
    "financial_aid_form",
    "scholarship_agreement",
    "housing_form",
    "transcript",
    "course_schedule",
    "other",
})

ALLOWED_CONTENT_TYPES = frozenset({
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
})

ALLOWED_EXTENSIONS = frozenset({".pdf", ".png", ".jpg", ".jpeg", ".docx"})

# Maps each document type to the office role that should be notified on upload.
_DOC_TYPE_TO_ROLE: dict[str, str] = {
    "immunization_record":   "health_services",
    "financial_aid_form":    "financial_aid",
    "scholarship_agreement": "financial_aid",
    "housing_form":          "residence_life",
    "photo_id":              "public_safety",
    "transcript":            "success_center",
    "course_schedule":       "success_center",
    "other":                 "registrar",
}


def _max_bytes() -> int:
    return settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _uploads_base() -> Path:
    """Returns the absolute uploads base directory, creating it if needed."""
    base = Path(settings.UPLOAD_DIR).resolve()
    base.mkdir(parents=True, exist_ok=True)
    return base


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_document_type(document_type: str) -> None:
    """Raises 422 if the document_type is not in the allowed set."""
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                f"'{document_type}' is not a valid document type. "
                f"Allowed types: {', '.join(sorted(ALLOWED_DOCUMENT_TYPES))}."
            ),
        )


def validate_upload(filename: str, content_type: str, content: bytes) -> None:
    """
    Raises an appropriate HTTP error if the file is not safe to accept.

    Checks (in order):
      1. File size <= MAX_UPLOAD_SIZE_MB
      2. Content-type is in the allowed set
      3. File extension matches an allowed extension
    """
    if len(content) > _max_bytes():
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=(
                f"File is too large. Maximum allowed size is "
                f"{settings.MAX_UPLOAD_SIZE_MB} MB."
            ),
        )

    if not content_type or content_type.split(";")[0].strip() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File type '{content_type}' is not supported. "
                "Allowed types: PDF, PNG, JPEG, DOCX."
            ),
        )

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File extension '{ext}' is not allowed. "
                "Allowed extensions: .pdf, .png, .jpg, .jpeg, .docx."
            ),
        )


def sanitize_filename(filename: str) -> str:
    """
    Strips path components and dangerous characters from a user-supplied filename.

    Examples:
      ../../evil.pdf  → evil.pdf
      my file (1).pdf → my_file__1_.pdf
      .hiddenfile.pdf → hiddenfile.pdf
    """
    # Strip any directory components — prevents path traversal via filename.
    filename = os.path.basename(filename)
    # Replace everything except word chars, dots, and hyphens.
    filename = re.sub(r"[^\w.\-]", "_", filename)
    # Remove leading dots that would create hidden files.
    filename = filename.lstrip(".")
    return filename or "unnamed"


def _compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _build_storage_key(application_id, safe_filename: str) -> str:
    """Returns the storage key (path relative to UPLOAD_DIR) for a new document."""
    unique = uuid.uuid4().hex
    stored_name = f"{unique}_{safe_filename}"
    return f"documents/application_{application_id}/{stored_name}"


def _save_to_disk(content: bytes, storage_key: str) -> None:
    """Writes file bytes to the correct path under UPLOAD_DIR, creating dirs as needed."""
    file_path = _uploads_base() / storage_key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(content)


def _resolve_file_path(storage_key: str) -> Path:
    """
    Resolves the storage_key to an absolute path and verifies it stays inside
    the uploads directory (guards against path-traversal in stored keys).
    """
    base = _uploads_base()
    candidate = (base / storage_key).resolve()
    # Ensure the resolved path is actually inside our uploads directory.
    if not str(candidate).startswith(str(base)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document storage key.",
        )
    return candidate


# ---------------------------------------------------------------------------
# Authorization helpers
# ---------------------------------------------------------------------------

def _get_application_or_404(db: Session, application_id) -> Application:
    app = db.query(Application).filter_by(id=application_id).first()
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return app


def _require_student_owns_application(
    db: Session, current_user: User, application: Application
) -> None:
    """Raises 404 if a student user does not own this application."""
    if current_user.account_type == "student":
        student = db.query(Student).filter_by(user_id=current_user.id).first()
        if student is None or application.student_id != student.id:
            raise HTTPException(status_code=404, detail="Application not found.")


def _can_read_application(
    db: Session, current_user: User, application: Application
) -> None:
    """
    Raises 404 if the user is not allowed to read this application's documents.

    Students may only access their own application.
    Officials and admins can access any application.
    """
    if current_user.account_type == "student":
        _require_student_owns_application(db, current_user, application)


# ---------------------------------------------------------------------------
# Core service functions
# ---------------------------------------------------------------------------

def upload_application_document(
    db: Session,
    application_id,
    current_user: User,
    document_type: str,
    filename: str,
    content_type: str,
    content: bytes,
) -> Document:
    """
    Validates and stores a document uploaded by a student.

    1. Verifies the application exists and belongs to the current student.
    2. Validates document_type, file extension, content-type, and size.
    3. Saves the file to disk with a safe unique name.
    4. Creates a Document row, linking to any previous version of the same type.
    5. Writes an audit log and creates an in-app notification for the relevant office.
    6. Commits and returns the Document.
    """
    application = _get_application_or_404(db, application_id)
    _require_student_owns_application(db, current_user, application)

    validate_document_type(document_type)
    validate_upload(filename, content_type, content)

    safe_name = sanitize_filename(filename)
    storage_key = _build_storage_key(application.id, safe_name)
    stored_filename = Path(storage_key).name

    # Find the current version of this document type so we can link the new one.
    previous = (
        db.query(Document)
        .filter_by(application_id=application.id, document_type=document_type)
        .order_by(Document.uploaded_at.desc())
        .first()
    )

    checksum = _compute_sha256(content)
    _save_to_disk(content, storage_key)

    doc = Document(
        application_id=application.id,
        uploaded_by_user_id=current_user.id,
        document_type=document_type,
        original_filename=filename,
        stored_filename=stored_filename,
        storage_backend="local",
        storage_key=storage_key,
        content_type=content_type.split(";")[0].strip(),
        size_bytes=len(content),
        checksum_sha256=checksum,
        status="uploaded",
        version_no=(previous.version_no + 1) if previous else 1,
        supersedes_document_id=previous.id if previous else None,
    )
    db.add(doc)
    db.flush()

    action = "document_replaced" if previous else "document_uploaded"
    audit_service.create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        application_id=application.id,
        action=action,
        details={
            "document_type": document_type,
            "original_filename": filename,
            "document_id": str(doc.id),
            "version_no": doc.version_no,
        },
    )

    role_key = _DOC_TYPE_TO_ROLE.get(document_type)
    if role_key:
        notification_service.create_role_notification(
            db=db,
            recipient_role_key=role_key,
            application_id=application.id,
            title=f"New document uploaded: {document_type.replace('_', ' ').title()}",
            body=(
                f"A student has uploaded a {document_type.replace('_', ' ')} document "
                f"for application {application.application_number}."
            ),
            event_type=f"document_uploaded_{document_type}_{doc.version_no}",
        )

    db.commit()
    db.refresh(doc)
    return doc


def list_application_documents(
    db: Session,
    application_id,
    current_user: User,
) -> list[Document]:
    """
    Returns all documents for an application, newest first.

    Students may only list documents for their own application.
    Officials and admins may list documents for any application.
    """
    application = _get_application_or_404(db, application_id)
    _can_read_application(db, current_user, application)

    return (
        db.query(Document)
        .filter_by(application_id=application.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )


def get_document_for_download(
    db: Session,
    document_id,
    current_user: User,
) -> tuple[Document, Path]:
    """
    Authorizes a user to download a document and returns (document, absolute_file_path).

    Raises:
      404 — document not found or student does not own the application
      400 — storage key is invalid (should not happen unless DB was tampered with)
      404 — file is missing from disk (logged, raises 404 to avoid leaking details)
    """
    doc = db.query(Document).filter_by(id=document_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    application = _get_application_or_404(db, doc.application_id)
    _can_read_application(db, current_user, application)

    file_path = _resolve_file_path(doc.storage_key)
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="The file is no longer available on the server.",
        )

    return doc, file_path
