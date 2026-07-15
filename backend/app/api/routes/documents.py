"""
Document routes.

POST /applications/{application_id}/documents  — student uploads a document
GET  /applications/{application_id}/documents  — list documents (authenticated)
GET  /documents/{document_id}/download         — download a document (authenticated)
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services import document_service

router = APIRouter(tags=["Documents"])


@router.post(
    "/applications/{application_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=201,
)
def upload_document(
    application_id: uuid.UUID,
    document_type: str = Form(..., description="Type of document being uploaded."),
    file: UploadFile = File(..., description="The document file (PDF, PNG, JPEG, or DOCX)."),
    current_user: User = Depends(deps.require_student),
    db: Session = Depends(get_db),
):
    """
    Upload a document for a registration application.

    Students can only upload documents for their own application.
    Officials cannot use this endpoint.
    """
    content = file.file.read()
    doc = document_service.upload_application_document(
        db=db,
        application_id=application_id,
        current_user=current_user,
        document_type=document_type,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "",
        content=content,
    )
    is_replacement = doc.version_no > 1
    message = (
        f"Document replaced successfully. This is version {doc.version_no} of your {document_type.replace('_', ' ')}."
        if is_replacement
        else f"Document uploaded successfully."
    )
    return DocumentUploadResponse(
        document=DocumentResponse.model_validate(doc),
        message=message,
    )


@router.get(
    "/applications/{application_id}/documents",
    response_model=list[DocumentResponse],
)
def list_documents(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all documents for an application, newest first.

    Students can only see their own application's documents.
    Officials and admins can see documents for any application.
    """
    docs = document_service.list_application_documents(
        db=db,
        application_id=application_id,
        current_user=current_user,
    )
    return [DocumentResponse.model_validate(d) for d in docs]


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download a document file.

    Students can only download their own documents.
    Officials and admins can download any document for review.
    The file is served directly — raw storage paths are not exposed.
    """
    doc, file_path = document_service.get_document_for_download(
        db=db,
        document_id=document_id,
        current_user=current_user,
    )
    return FileResponse(
        path=str(file_path),
        media_type=doc.content_type,
        filename=doc.original_filename,
    )
