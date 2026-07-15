import uuid

from sqlalchemy import (
    Column, String, Text, Boolean, SmallInteger,
    DateTime, ForeignKey, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Notification(Base):
    """
    An in-app message sent to a student or office when something important happens.

    Notifications can target either a specific user (recipient_user_id) or
    an entire office role (recipient_role_id). For example:
      - When a student's application is approved, they get a personal notification.
      - When a new application needs Registrar review, the whole Registrar role
        gets a notification so any staff member at that desk can see it.

    dedupe_key prevents duplicate notifications for the same event.
    For example, if two processes both try to notify the Registrar about the
    same new application, the unique index on dedupe_key stops a duplicate row.
    """

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_unread", "recipient_user_id", "is_read", "created_at"),
        Index("ix_notifications_role_unread", "recipient_role_id", "is_read", "created_at"),
        CheckConstraint(
            "channel IN ('in_app', 'email')",
            name="ck_notifications_channel",
        ),
        CheckConstraint(
            "delivery_status IN ('pending', 'sent', 'failed', 'read')",
            name="ck_notifications_delivery_status",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Personal recipient (may be null if targeting a whole role)
    recipient_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Role-level recipient (may be null if targeting a specific user)
    recipient_role_id = Column(
        SmallInteger,
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    application_id = Column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Machine-readable event name, e.g. 'clearance_approved', 'correction_requested'
    event_type = Column(Text, nullable=False)
    channel = Column(String, nullable=False, default="in_app")
    title = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    # Extra data attached to this notification for the frontend to use
    payload_json = Column(JSONB, nullable=False, default=dict)
    delivery_status = Column(String, nullable=False, default="pending")
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    # Optional key for preventing duplicate notifications for the same event
    dedupe_key = Column(Text, nullable=True, unique=True)

    recipient = relationship("User", foreign_keys=[recipient_user_id])
    application = relationship("Application", back_populates="notifications")
