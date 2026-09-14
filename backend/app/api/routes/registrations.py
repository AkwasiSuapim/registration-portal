"""
Registration routes — the incremental draft-save wizard API (PHASE C).

Student-only and always scoped to the caller's own student profile
(deps.get_current_student) — there is no application_id path a student
can reach that belongs to another student; every lookup 404s instead of
confirming another student's data exists (see registration_service).

Additive to, not a replacement for, POST /applications (see
app/api/routes/applications.py) — both endpoints ultimately produce the
same kind of Application row and share the same clearance workflow.
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.schemas.registration import (
    RegistrationClearancesResponse,
    RegistrationDocumentsResponse,
    RegistrationResponse,
    RegistrationSubmitResponse,
    SectionSaveRequest,
)
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services import document_service, registration_service

router = APIRouter(prefix="/registrations", tags=["Registrations"])


@router.get("/current", response_model=RegistrationResponse)
def get_current(
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    """Returns the student's in-progress draft, if one exists."""
    draft = registration_service.get_current_draft(db, student)
    if draft is None:
        raise HTTPException(status_code=404, detail="No registration in progress.")
    return draft


@router.post("/", response_model=RegistrationResponse, status_code=status.HTTP_200_OK)
def start_registration(
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    """
    Starts (or resumes) a draft registration. Idempotent: a student may
    only have one open draft at a time, so calling this again simply
    returns the existing one instead of creating a duplicate.
    """
    application, _created = registration_service.get_or_create_draft(db, student)
    return application


@router.patch("/{application_id}/sections/{section}", response_model=RegistrationResponse)
def save_section(
    application_id: uuid.UUID,
    section: str,
    body: SectionSaveRequest,
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    application = registration_service.get_owned_application(db, student, application_id)
    return registration_service.save_section(db, application, section, body.data)


@router.post("/{application_id}/submit", response_model=RegistrationSubmitResponse)
def submit(
    application_id: uuid.UUID,
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    application = registration_service.get_owned_application(db, student, application_id)
    application, instruction = registration_service.submit_registration(db, application, student.user_id)
    return RegistrationSubmitResponse(application=application, public_safety_instruction=instruction)


@router.get("/history", response_model=list[RegistrationResponse])
def get_history(
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    return registration_service.get_history(db, student)


@router.get("/{application_id}/clearances", response_model=RegistrationClearancesResponse)
def get_clearances(
    application_id: uuid.UUID,
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    application = registration_service.get_owned_application(db, student, application_id)
    instruction = registration_service.get_public_safety_instruction(application)
    return RegistrationClearancesResponse(
        application_id=application.id,
        overall_status=application.overall_status,
        current_step=application.current_step,
        clearances=application.clearances,
        public_safety_instruction=instruction,
    )


@router.get("/{application_id}/documents", response_model=RegistrationDocumentsResponse)
def get_documents(
    application_id: uuid.UUID,
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    application = registration_service.get_owned_application(db, student, application_id)
    docs = document_service.list_application_documents(db, application.id, student.user)
    return RegistrationDocumentsResponse(application_id=application.id, documents=docs)


@router.post(
    "/{application_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    application_id: uuid.UUID,
    document_type: str = Form(..., description="Type of document being uploaded."),
    file: UploadFile = File(..., description="The document file (PDF, PNG, JPEG, or DOCX)."),
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    """Same validation/storage/ownership rules as
    POST /applications/{id}/documents (see document_service) — this is
    the same capability under the /registrations path."""
    application = registration_service.get_owned_application(db, student, application_id)
    content = file.file.read()
    doc = document_service.upload_application_document(
        db=db,
        application_id=application.id,
        current_user=student.user,
        document_type=document_type,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "",
        content=content,
    )
    is_replacement = doc.version_no > 1
    message = (
        f"Document replaced successfully. This is version {doc.version_no} of your "
        f"{document_type.replace('_', ' ')}."
        if is_replacement
        else "Document uploaded successfully."
    )
    return DocumentUploadResponse(document=DocumentResponse.model_validate(doc), message=message)
