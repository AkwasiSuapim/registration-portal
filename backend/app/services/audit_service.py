"""
Audit service — records significant events to the append-only audit log
and provides read access to that history.

Every important action (application submitted, clearance updated, login failed, etc.)
should call create_audit_log so the institution has a defensible history.
Audit rows are never edited or deleted.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.student import Student
from app.models.user import User


def create_audit_log(
    db: Session,
    actor_user_id,
    application_id,
    action: str,
    details: dict | None = None,
    success: bool = True,
    actor_role_id=None,
) -> AuditLog:
    """
    Writes one audit log entry.

    actor_user_id  — the UUID of the user who performed the action
    application_id — the UUID of the application this action relates to (may be None)
    action         — machine-readable event name, e.g. 'application_submitted'
    details        — optional dict stored as JSONB in after_state_json
    success        — False for failed attempts (wrong password, validation error, etc.)
    actor_role_id  — optional SmallInteger role id of the acting user

    The row is added to the session but NOT committed here — the caller commits.
    """
    log = AuditLog(
        actor_user_id=actor_user_id,
        actor_role_id=actor_role_id,
        application_id=application_id,
        entity_type="application",
        entity_id=application_id,
        action=action,
        after_state_json=details,
        success=success,
    )
    db.add(log)
    return log


def get_application_audit_history(
    db: Session,
    current_user: User,
    application_id,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    """
    Returns audit log entries for a specific application, newest first.

    Students may only view history for their own application.
    Officials and admins may view any application's history.
    Raises 404 if the application does not exist or is not accessible.
    """
    application = db.query(Application).filter_by(id=application_id).first()
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    if current_user.account_type == "student":
        student = db.query(Student).filter_by(user_id=current_user.id).first()
        if student is None or application.student_id != student.id:
            raise HTTPException(status_code=404, detail="Application not found.")

    return (
        db.query(AuditLog)
        .filter_by(application_id=application_id)
        .order_by(AuditLog.occurred_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_all_audit_logs(
    db: Session,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    """Admin-only: returns recent audit log entries across all applications, newest first."""
    return (
        db.query(AuditLog)
        .order_by(AuditLog.occurred_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
