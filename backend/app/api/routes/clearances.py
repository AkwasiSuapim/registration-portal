"""
Clearance routes.

PATCH /clearances/{clearance_id}  — official updates a clearance status
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.models.official import Official
from app.models.user import User
from app.schemas.clearance import (
    ClearanceActionRequest,
    ClearanceResponse,
    ClearanceUpdateResponse,
)
from app.services import clearance_service

router = APIRouter(prefix="/clearances", tags=["Clearances"])


@router.patch("/{clearance_id}", response_model=ClearanceUpdateResponse)
def update_clearance(
    clearance_id: uuid.UUID,
    action_data: ClearanceActionRequest,
    current_user: User = Depends(deps.require_official),
    official: Official = Depends(deps.get_current_official),
    db: Session = Depends(get_db),
):
    """
    Updates the status of a clearance.

    The requesting official must be responsible for this clearance's office.
    The clearance must be in a reviewable state (ready or needs_student_action).

    Returns the updated clearance, the new application status, and any
    clearances that were unlocked as a result of this action.
    """
    result = clearance_service.update_clearance_status(
        db=db,
        official=official,
        role_key=current_user.role.role_key,
        clearance_id=clearance_id,
        action=action_data.action,
        message=action_data.message,
    )
    return ClearanceUpdateResponse(
        clearance=ClearanceResponse.model_validate(result["clearance"]),
        application_overall_status=result["application_overall_status"],
        application_current_step=result["application_current_step"],
        unlocked_clearances=[
            ClearanceResponse.model_validate(c) for c in result["unlocked_clearances"]
        ],
    )
