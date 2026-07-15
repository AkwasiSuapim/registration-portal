from sqlalchemy import (
    Column, BigInteger, Text, Boolean, SmallInteger,
    DateTime, ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.sql import func

from app.database import Base


class AuditLog(Base):
    """
    An append-only record of every significant action in the system.

    Audit logs are never edited or deleted — they are the institution's
    defensible record of what happened, who did it, and when.

    Every clearance approval, rejection, correction request, document upload,
    login, and status change should produce an audit log row.

    before_state_json and after_state_json capture what changed so
    administrators can reconstruct the history of any application.

    Foreign keys use ON DELETE SET NULL so that audit logs survive even
    if a user account or application is removed from the system.
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_application_time", "application_id", "occurred_at"),
        Index("ix_audit_logs_actor_time", "actor_user_id", "occurred_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
    )

    # BigInteger auto-increment for fast append and time-ordered reads
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    occurred_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    # The user who performed the action (null if the action was system-generated)
    actor_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_role_id = Column(
        SmallInteger,
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    # The application this action relates to (null for login events, etc.)
    application_id = Column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
    )
    # What kind of thing was changed, e.g. 'clearance', 'application', 'document'
    entity_type = Column(Text, nullable=False)
    # The UUID of the specific row that was changed
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    # What happened, e.g. 'clearance_approved', 'application_created', 'login_failed'
    action = Column(Text, nullable=False)
    # Optional free-text explanation or office message
    reason = Column(Text, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    # The client IP address, stored as PostgreSQL inet type
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    # Correlates all log entries from a single HTTP request
    request_id = Column(UUID(as_uuid=True), nullable=True)
    # Snapshot of the row before the change
    before_state_json = Column(JSONB, nullable=True)
    # Snapshot of the row after the change
    after_state_json = Column(JSONB, nullable=True)
    # Optional note added by an administrator for institutional records
    annotation = Column(Text, nullable=True)
