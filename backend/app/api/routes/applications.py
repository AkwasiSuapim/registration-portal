"""
Application routes — student registration application submission and retrieval.

POST /applications                Submit a new application (students only)
GET  /applications/{id}           Get one application by ID
GET  /applications/{id}/status    Get the clearance workflow status summary
GET  /applications/{id}/review    Full application view for officials and admins
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationResponse, ApplicationStatusResponse
from app.schemas.clearance import ClearanceResponse
from app.schemas.official import ApplicationReviewResponse
from app.services import application_service, clearance_service

router = APIRouter(tags=["Applications"])


@router.post(
    "/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_application(
    application_data: ApplicationCreate,
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    """Submit a new registration application. Requires a logged-in student."""
    return application_service.create_student_application(
        db=db,
        student=student,
        application_data=application_data,
        actor_user_id=student.user_id,
    )


@router.get("/applications/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get one application by ID.

    Students can only see their own application.
    Officials and admins can see any application (read-only in Phase 5).
    """
    return application_service.get_application_for_authorized_user(
        db=db,
        current_user=current_user,
        application_id=application_id,
    )


@router.get("/applications/{application_id}/status", response_model=ApplicationStatusResponse)
def get_application_status(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a summary of the clearance workflow status for one application.

    Students can only see their own application status.
    Officials and admins can see any application status.
    """
    application = application_service.get_application_for_authorized_user(
        db=db,
        current_user=current_user,
        application_id=application_id,
    )
    return ApplicationStatusResponse(
        application_id=application.id,
        application_number=application.application_number,
        overall_status=application.overall_status,
        current_step=application.current_step,
        clearances=[ClearanceResponse.model_validate(c) for c in application.clearances],
    )


@router.get(
    "/applications/{application_id}/review",
    response_model=ApplicationReviewResponse,
)
def review_application(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.require_official_or_admin),
    db: Session = Depends(get_db),
):
    """
    Returns a full application view for officials and admins to review.

    Includes student profile, courses, and all clearance statuses.
    Students cannot access this endpoint.
    """
    return clearance_service.get_application_for_official_review(db, application_id)
