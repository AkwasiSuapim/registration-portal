"""
Clearance service — business logic for the official clearance review workflow.

Each office is responsible for exactly one clearance in the workflow.
Officials can update the status of their clearance when it is in a reviewable state.

Supported actions:
  approve                  — mark cleared; unlocks downstream clearances automatically
  request_correction       — ask the student to fix something (message required)
  reject                   — reject at this step (message required)
  mark_in_person_required  — Public Safety only: student must visit in person
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.clearance import Clearance
from app.models.official import Official
from app.schemas.clearance import ClearanceResponse
from app.schemas.official import ApplicationReviewResponse, OfficialQueueItemResponse
from app.services import audit_service, notification_service
from app.services.workflow_service import (
    calculate_overall_status,
    can_role_update_clearance,
    get_allowed_clearance_for_role,
    get_next_current_step,
    get_role_key_for_clearance,
    unlock_ready_clearances,
)

# Maps each action name to the resulting clearance state.
_ACTION_MAP = {
    "approve":                 {"status": "approved",             "availability": "completed",          "is_final": True},
    "request_correction":      {"status": "correction_required",  "availability": "needs_student_action","is_final": False},
    "reject":                  {"status": "rejected",             "availability": "completed",          "is_final": True},
    "mark_in_person_required": {"status": "in_person_required",  "availability": "needs_student_action","is_final": False},
}

_NOTIFY_TITLE = {
    "approve":                 "Your {label} has been approved",
    "request_correction":      "Correction requested for {label}",
    "reject":                  "Your {label} has been rejected",
    "mark_in_person_required": "In-person visit required: {label}",
}

_NOTIFY_BODY = {
    "approve":                 (
        "Your {label} clearance has been reviewed and approved. "
        "Check your registration portal for the next step."
    ),
    "request_correction": (
        "The {label} office has requested a correction. Message: {message}"
    ),
    "reject": (
        "Your {label} clearance has been rejected. "
        "Please contact the office directly for assistance. Message: {message}"
    ),
    "mark_in_person_required": (
        "Your {label} clearance requires an in-person visit to the Public Safety office "
        "to complete your registration."
    ),
}


def get_official_queue(
    db: Session,
    role_key: str,
    availability: str | None = None,
    status_filter: str | None = None,
) -> list[OfficialQueueItemResponse]:
    """
    Returns all clearances assigned to this official's office role,
    with nested application and student context, optionally filtered.
    """
    clearance_key = get_allowed_clearance_for_role(role_key)
    if clearance_key is None:
        return []

    query = (
        db.query(Clearance)
        .options(
            joinedload(Clearance.application).joinedload(Application.student),
        )
        .join(Application, Clearance.application_id == Application.id)
        .filter(Clearance.clearance_key == clearance_key)
    )

    if availability:
        query = query.filter(Clearance.availability == availability)
    if status_filter:
        query = query.filter(Clearance.status == status_filter)

    query = query.order_by(Application.submitted_at.asc())

    return [_build_queue_item(c) for c in query.all()]


def _build_queue_item(clearance: Clearance) -> OfficialQueueItemResponse:
    app = clearance.application
    student = app.student
    return OfficialQueueItemResponse(
        application_id=app.id,
        application_number=app.application_number,
        student_name=f"{student.first_name} {student.last_name}",
        student_no=student.student_no,
        term_code=app.term_code,
        academic_year=app.academic_year,
        major=app.major,
        classification=app.classification,
        housing_required=app.housing_required,
        overall_status=app.overall_status,
        clearance_id=clearance.id,
        clearance_key=clearance.clearance_key,
        clearance_label=clearance.clearance_label,
        clearance_status=clearance.status,
        clearance_availability=clearance.availability,
        blocked_reason=clearance.blocked_reason,
        submitted_at=app.submitted_at,
    )


def get_application_for_official_review(
    db: Session,
    application_id: uuid.UUID,
) -> ApplicationReviewResponse:
    """
    Loads a full application with student, courses, and clearances for an official to review.
    Returns 404 if the application does not exist.
    """
    application = (
        db.query(Application)
        .options(
            joinedload(Application.student),
            joinedload(Application.courses),
            joinedload(Application.clearances),
        )
        .filter_by(id=application_id)
        .first()
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return ApplicationReviewResponse.model_validate(application)


def update_clearance_status(
    db: Session,
    official: Official,
    role_key: str,
    clearance_id: uuid.UUID,
    action: str,
    message: str | None = None,
) -> dict:
    """
    Applies an official's decision to a clearance and advances the workflow.

    Steps:
      1. Load the clearance (404 if missing).
      2. Verify this official's role owns this clearance (403 if not).
      3. Verify the clearance is in a reviewable state (409 if locked or finalized).
      4. Enforce action-specific rules (Public Safety only for mark_in_person_required).
      5. Apply the status change.
      6. Flush so unlock_ready_clearances sees the latest state within this transaction.
      7. Unlock any downstream clearances that are now unblocked.
      8. Recalculate overall_status and current_step on the application.
      9. Write audit log and in-app notifications.
     10. Commit and return a result dict for the route to serialize.
    """
    now = datetime.now(timezone.utc)

    clearance = (
        db.query(Clearance)
        .options(
            joinedload(Clearance.application).joinedload(Application.student),
        )
        .filter_by(id=clearance_id)
        .first()
    )

    if clearance is None:
        raise HTTPException(status_code=404, detail="Clearance not found.")

    application = clearance.application

    # Role ownership check.
    if not can_role_update_clearance(role_key, clearance.clearance_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your office is not responsible for '{clearance.clearance_label}'.",
        )

    # State guard.
    if clearance.availability == "locked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This clearance is not yet open for review. "
                "It is still waiting on a prerequisite approval."
            ),
        )
    if clearance.availability == "completed" and clearance.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This clearance has already been finalized and cannot be changed.",
        )
    if clearance.status == "not_required":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This clearance is not required and cannot be updated.",
        )

    # Action-specific rules.
    if action == "mark_in_person_required" and role_key != "public_safety":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Public Safety can mark a clearance as requiring an in-person visit.",
        )

    before_state = {
        "status": clearance.status,
        "availability": clearance.availability,
        "message": clearance.message,
    }

    # Apply.
    mapping = _ACTION_MAP[action]
    clearance.status = mapping["status"]
    clearance.availability = mapping["availability"]
    clearance.message = message
    clearance.reviewed_by_official_id = official.id
    clearance.reviewed_at = now
    clearance.last_transition_at = now
    clearance.version = (clearance.version or 0) + 1
    if mapping["is_final"]:
        clearance.completed_at = now

    # Flush before unlock so the dependency checker sees the approved status.
    db.flush()

    newly_unlocked = unlock_ready_clearances(db, application)

    fresh_clearances = db.query(Clearance).filter_by(application_id=application.id).all()
    application.overall_status = calculate_overall_status(fresh_clearances)
    application.current_step = get_next_current_step(fresh_clearances)

    audit_service.create_audit_log(
        db=db,
        actor_user_id=official.user_id,
        application_id=application.id,
        action=f"clearance_{action}",
        details={
            "clearance_key": clearance.clearance_key,
            "clearance_id": str(clearance.id),
            "before": before_state,
            "after": {"status": clearance.status, "availability": clearance.availability},
            "message": message,
        },
    )

    _notify_student(db, application, clearance, action, message)
    _notify_unlocked_offices(db, application, newly_unlocked)

    db.commit()

    return {
        "clearance": clearance,
        "application_overall_status": application.overall_status,
        "application_current_step": application.current_step,
        "unlocked_clearances": newly_unlocked,
    }


def _notify_student(db, application, clearance, action, message):
    student_user_id = application.student.user_id
    title = _NOTIFY_TITLE[action].format(label=clearance.clearance_label)
    body = _NOTIFY_BODY[action].format(
        label=clearance.clearance_label,
        message=message or "",
    )
    notification_service.create_user_notification(
        db=db,
        recipient_user_id=student_user_id,
        application_id=application.id,
        title=title,
        body=body,
        event_type=f"clearance_{action}",
    )


def _notify_unlocked_offices(db, application, newly_unlocked):
    for clearance in newly_unlocked:
        role_key = get_role_key_for_clearance(clearance.clearance_key)
        if role_key:
            notification_service.create_role_notification(
                db=db,
                recipient_role_key=role_key,
                application_id=application.id,
                title=f"New application ready: {clearance.clearance_label}",
                body=(
                    f"A student registration application is now ready for your review "
                    f"at the {clearance.clearance_label} step."
                ),
                event_type=f"clearance_unlocked_{clearance.clearance_key}",
            )
