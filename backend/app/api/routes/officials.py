"""
Official routes.

GET /officials/me/queue  — returns clearances assigned to this official's office
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.models.official import Official
from app.models.user import User
from app.schemas.official import ApplicationReviewResponse, OfficialQueueItemResponse
from app.services import clearance_service

router = APIRouter(prefix="/officials", tags=["Officials"])


@router.get("/me/queue", response_model=list[OfficialQueueItemResponse])
def get_queue(
    availability: str | None = Query(
        None,
        description=(
            "Filter by clearance availability. "
            "One of: ready, locked, completed, needs_student_action."
        ),
    ),
    status: str | None = Query(
        None,
        description=(
            "Filter by clearance status. "
            "One of: pending, approved, correction_required, rejected, "
            "in_person_required, not_required."
        ),
    ),
    current_user: User = Depends(deps.require_official),
    official: Official = Depends(deps.get_current_official),
    db: Session = Depends(get_db),
):
    """
    Returns all clearances assigned to this official's office, ordered by submission date.

    Pass ?availability=ready to see only applications that are waiting for review.
    """
    return clearance_service.get_official_queue(
        db=db,
        role_key=current_user.role.role_key,
        availability=availability,
        status_filter=status,
    )
