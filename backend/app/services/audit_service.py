"""
Audit service — records significant events to the append-only audit log.

Every important action (application submitted, clearance updated, login failed, etc.)
should call create_audit_log so the institution has a defensible history.
Audit rows are never edited or deleted.
"""

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    actor_user_id,
    application_id,
    action: str,
    details: dict | None = None,
    success: bool = True,
) -> AuditLog:
    """
    Writes one audit log entry.

    actor_user_id  — the UUID of the user who performed the action
    application_id — the UUID of the application this action relates to (may be None)
    action         — machine-readable event name, e.g. 'application_submitted'
    details        — optional dict stored as JSONB in after_state_json
    success        — False for failed attempts (wrong password, validation error, etc.)

    The row is added to the session but NOT committed here — the caller commits.
    """
    log = AuditLog(
        actor_user_id=actor_user_id,
        application_id=application_id,
        entity_type="application",
        entity_id=application_id,
        action=action,
        after_state_json=details,
        success=success,
    )
    db.add(log)
    return log
