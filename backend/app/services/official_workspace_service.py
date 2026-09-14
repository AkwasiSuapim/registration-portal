"""
Official workspace service (PHASE F) — dashboard summary and clearance
claiming on top of the existing clearance_service/workflow_service
business logic. Every function here derives the caller's office from
their authenticated Official/User row — never from a request parameter.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.clearance import Clearance
from app.models.official import Official
from app.schemas.official_workspace import OfficialDashboardResponse, OfficialQueueItem
from app.services import audit_service, clearance_service
from app.services.workflow_service import get_allowed_clearance_for_role


def _build_queue_item(clearance: Clearance, official_id: uuid.UUID) -> OfficialQueueItem:
    app = clearance.application
    student = app.student
    return OfficialQueueItem(
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
        claimed_by_official_id=clearance.claimed_by_official_id,
        claimed_by_me=clearance.claimed_by_official_id == official_id,
        claimed_at=clearance.claimed_at,
    )


def get_queue(
    db: Session,
    role_key: str,
    official_id: uuid.UUID,
    availability: str | None = None,
    status_filter: str | None = None,
) -> list[OfficialQueueItem]:
    clearance_key = get_allowed_clearance_for_role(role_key)
    if clearance_key is None:
        return []

    query = (
        db.query(Clearance)
        .options(joinedload(Clearance.application).joinedload(Application.student))
        .join(Application, Clearance.application_id == Application.id)
        .filter(Clearance.clearance_key == clearance_key)
    )
    if availability:
        query = query.filter(Clearance.availability == availability)
    if status_filter:
        query = query.filter(Clearance.status == status_filter)
    query = query.order_by(Application.submitted_at.asc())

    return [_build_queue_item(c, official_id) for c in query.all()]


def get_dashboard(db: Session, official: Official, role_key: str, role_name: str) -> OfficialDashboardResponse:
    items = get_queue(db, role_key, official.id)
    open_items = [i for i in items if i.clearance_availability in ("ready", "needs_student_action")]
    new_count = sum(1 for i in open_items if i.claimed_by_official_id is None)
    claimed_by_me = sum(1 for i in open_items if i.claimed_by_me)
    completed_count = sum(1 for i in items if i.clearance_availability == "completed")
    return OfficialDashboardResponse(
        office=role_key.upper(),
        role_name=role_name,
        new_count=new_count,
        ready_count=sum(1 for i in open_items if i.clearance_availability == "ready" and i.claimed_by_official_id is None),
        claimed_by_me_count=claimed_by_me,
        completed_count=completed_count,
        total_open_count=len(open_items),
    )


def _get_own_clearance_or_404(db: Session, role_key: str, clearance_id: uuid.UUID) -> Clearance:
    clearance = db.query(Clearance).filter_by(id=clearance_id).first()
    if clearance is None:
        raise HTTPException(404, "Clearance not found.")
    if get_allowed_clearance_for_role(role_key) != clearance.clearance_key:
        raise HTTPException(403, f"Your office is not responsible for '{clearance.clearance_label}'.")
    return clearance


def resolve_own_clearance_for_application(
    db: Session, role_key: str, application_id: uuid.UUID
) -> Clearance:
    """Returns the one clearance on this application that belongs to the
    caller's own office — this is how /official/* routes accept only an
    application_id (never a clearance_id) from the client."""
    clearance_key = get_allowed_clearance_for_role(role_key)
    if clearance_key is None:
        raise HTTPException(403, "Your account has no office clearance to act on.")
    clearance = (
        db.query(Clearance)
        .filter_by(application_id=application_id, clearance_key=clearance_key)
        .first()
    )
    if clearance is None:
        raise HTTPException(404, "No clearance for your office exists on this application.")
    return clearance


def claim(db: Session, official: Official, role_key: str, clearance_id: uuid.UUID) -> Clearance:
    clearance = _get_own_clearance_or_404(db, role_key, clearance_id)
    if clearance.availability not in ("ready", "needs_student_action"):
        raise HTTPException(409, "This clearance is not open for review right now.")
    if clearance.claimed_by_official_id is not None and clearance.claimed_by_official_id != official.id:
        raise HTTPException(409, "This item has already been claimed by a colleague.")

    clearance.claimed_by_official_id = official.id
    clearance.claimed_at = datetime.now(timezone.utc)
    audit_service.create_audit_log(
        db=db, actor_user_id=official.user_id, application_id=clearance.application_id,
        action="clearance_claimed", details={"clearance_id": str(clearance.id)},
    )
    db.commit()
    db.refresh(clearance)
    return clearance


def unclaim(db: Session, official: Official, role_key: str, clearance_id: uuid.UUID) -> Clearance:
    clearance = _get_own_clearance_or_404(db, role_key, clearance_id)
    if clearance.claimed_by_official_id != official.id:
        raise HTTPException(409, "You have not claimed this item.")

    clearance.claimed_by_official_id = None
    clearance.claimed_at = None
    audit_service.create_audit_log(
        db=db, actor_user_id=official.user_id, application_id=clearance.application_id,
        action="clearance_unclaimed", details={"clearance_id": str(clearance.id)},
    )
    db.commit()
    db.refresh(clearance)
    return clearance


def make_decision(
    db: Session,
    official: Official,
    role_key: str,
    application_id: uuid.UUID,
    action: str,
    message: str | None,
) -> dict:
    """
    Resolves which clearance to act on from the caller's own office
    (get_allowed_clearance_for_role) instead of requiring the client to
    know/send a clearance_id — the frontend only ever needs an
    application_id here.
    """
    clearance = resolve_own_clearance_for_application(db, role_key, application_id)

    result = clearance_service.update_clearance_status(
        db=db, official=official, role_key=role_key,
        clearance_id=clearance.id, action=action, message=message,
    )
    # A finalized decision releases any claim automatically.
    if clearance.availability == "completed":
        clearance.claimed_by_official_id = None
        clearance.claimed_at = None
        db.commit()
    return result
