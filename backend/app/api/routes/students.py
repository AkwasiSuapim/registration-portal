"""
Student routes — endpoints that operate on the currently logged-in student's profile.

GET /students/me/applications  List the current student's submitted applications
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.schemas.application import ApplicationResponse
from app.services import application_service

router = APIRouter(tags=["Students"])


@router.get("/students/me/applications", response_model=list[ApplicationResponse])
def get_my_applications(
    student=Depends(deps.get_current_student),
    db: Session = Depends(get_db),
):
    """
    Returns all registration applications submitted by the currently logged-in student.

    The list is sorted newest first. A student never sees another student's applications —
    ownership is determined by the JWT token, not by any URL parameter.
    """
    return application_service.get_student_applications(db=db, student=student)
