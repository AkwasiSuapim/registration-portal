"""
Notification service — creates in-app notification rows.

Notifications inform students and office staff about important events.
No email is sent in this phase — only database rows are created.
"""

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.role import Role


def create_role_notification(
    db: Session,
    recipient_role_key: str,
    application_id,
    title: str,
    body: str,
    event_type: str = "notification",
) -> Notification | None:
    """
    Creates a notification visible to everyone who holds a given office role.

    Uses dedupe_key to prevent the same event from creating duplicate notifications
    if this function is called more than once for the same application and role.

    Adds to the session but does NOT commit — the caller commits.
    Returns None if the role does not exist in the database.
    """
    role = db.query(Role).filter_by(role_key=recipient_role_key).first()
    if role is None:
        return None

    dedupe_key = f"app:{application_id}:{event_type}:{recipient_role_key}"

    if db.query(Notification).filter_by(dedupe_key=dedupe_key).first():
        return None

    notification = Notification(
        recipient_role_id=role.id,
        application_id=application_id,
        event_type=event_type,
        title=title,
        body=body,
        dedupe_key=dedupe_key,
        payload_json={"application_id": str(application_id)},
    )
    db.add(notification)
    return notification


def create_user_notification(
    db: Session,
    recipient_user_id,
    application_id,
    title: str,
    body: str,
    event_type: str = "notification",
) -> Notification:
    """
    Creates a notification for one specific user.

    Adds to the session but does NOT commit — the caller commits.
    """
    notification = Notification(
        recipient_user_id=recipient_user_id,
        application_id=application_id,
        event_type=event_type,
        title=title,
        body=body,
        payload_json={"application_id": str(application_id) if application_id else None},
    )
    db.add(notification)
    return notification
