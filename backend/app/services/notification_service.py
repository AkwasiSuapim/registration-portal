"""
Notification service — creates, lists, and marks in-app notifications.

Notifications inform students and office staff about important events.
No email is sent in this phase — only database rows are created.

Visibility rules:
  Students  — see only notifications addressed to their user_id.
  Officials — see notifications addressed to their user_id or their role_id.
  Admins    — see notifications addressed to their user_id or their role_id.
"""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User


# ---------------------------------------------------------------------------
# Notification creation (called by other services — no commit here)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Visibility filter
# ---------------------------------------------------------------------------

def _notification_filter(current_user: User):
    """Returns the SQLAlchemy filter condition for notifications visible to current_user."""
    if current_user.account_type == "student":
        return Notification.recipient_user_id == current_user.id
    return or_(
        Notification.recipient_user_id == current_user.id,
        Notification.recipient_role_id == current_user.role_id,
    )


# ---------------------------------------------------------------------------
# Read functions
# ---------------------------------------------------------------------------

def get_notifications_for_user(
    db: Session,
    current_user: User,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[Notification]:
    query = db.query(Notification).filter(_notification_filter(current_user))
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    return (
        query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_unread_notification_count(db: Session, current_user: User) -> dict:
    base = db.query(Notification).filter(_notification_filter(current_user))
    total = base.count()
    unread = base.filter(Notification.is_read == False).count()  # noqa: E712
    return {"unread_count": unread, "total_count": total}


def user_can_access_notification(current_user: User, notification: Notification) -> bool:
    """Returns True if current_user is allowed to read this notification."""
    if current_user.account_type == "student":
        return notification.recipient_user_id == current_user.id
    return (
        notification.recipient_user_id == current_user.id
        or notification.recipient_role_id == current_user.role_id
    )


# ---------------------------------------------------------------------------
# Mark-as-read functions
# ---------------------------------------------------------------------------

def mark_notification_as_read(
    db: Session,
    current_user: User,
    notification_id,
) -> Notification:
    """
    Marks a single notification as read. Returns the updated notification.

    Raises 404 if the notification does not exist or the user cannot access it.
    Idempotent: calling this on an already-read notification is safe.
    """
    notification = db.query(Notification).filter_by(id=notification_id).first()
    if notification is None or not user_can_access_notification(current_user, notification):
        raise HTTPException(status_code=404, detail="Notification not found.")
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        notification.delivery_status = "read"
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_notifications_as_read(db: Session, current_user: User) -> int:
    """
    Marks all unread notifications visible to current_user as read.

    Returns the number of notifications updated.
    """
    now = datetime.now(timezone.utc)
    count = (
        db.query(Notification)
        .filter(_notification_filter(current_user), Notification.is_read == False)  # noqa: E712
        .update(
            {"is_read": True, "read_at": now, "delivery_status": "read"},
            synchronize_session="fetch",
        )
    )
    db.commit()
    return count
