import uuid

from sqlalchemy import (
    Column, String, Text, Boolean, Integer, SmallInteger,
    DateTime, ForeignKey, Index, UniqueConstraint, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Clearance(Base):
    """
    Represents one office's review task for a single application.

    Each application has exactly seven clearance rows — one per office.
    This is the core work-queue table: office dashboards query it to see
    which applications they need to act on.

    status answers: "What has this office decided?"
      pending             — no decision yet
      approved            — office approved this clearance
      correction_required — office asked the student to fix something
      rejected            — office rejected; blocks registration
      in_person_required  — Public Safety only; student must visit in person
      not_required        — skipped (e.g. Residence Life for commuter students)

    availability answers: "Can this office act right now?"
      locked              — prerequisites not yet met; office cannot act
      ready               — prerequisites met; office can review now
      completed           — a final decision has been made (approved/rejected/etc.)
      needs_student_action — student must respond to a correction request
    """

    __tablename__ = "clearances"
    __table_args__ = (
        # Each application has exactly one clearance per clearance_key
        UniqueConstraint(
            "application_id", "clearance_key",
            name="uq_clearances_app_key",
        ),
        # Office queue lookup: "show me all ready clearances for my office"
        Index("ix_clearances_queue", "office_role_id", "availability", "status"),
        Index("ix_clearances_app_status", "application_id", "status"),
        CheckConstraint(
            "status IN ("
            "'pending', 'approved', 'correction_required', "
            "'rejected', 'in_person_required', 'not_required')",
            name="ck_clearances_status",
        ),
        CheckConstraint(
            "availability IN ('locked', 'ready', 'completed', 'needs_student_action')",
            name="ck_clearances_availability",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Machine-readable key, e.g. 'financial_aid'
    clearance_key = Column(Text, nullable=False)
    # Human-readable label, e.g. 'Financial Aid Clearance'
    clearance_label = Column(Text, nullable=False)
    # Which office role is responsible for this clearance
    office_role_id = Column(SmallInteger, ForeignKey("roles.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")
    availability = Column(String, nullable=False, default="locked")
    # False only for Residence Life when housing_required is False
    is_required = Column(Boolean, nullable=False, default=True)
    # Human-readable explanation of why this clearance is still locked
    blocked_reason = Column(Text, nullable=True)
    # The official who last reviewed this clearance
    reviewed_by_official_id = Column(
        UUID(as_uuid=True),
        ForeignKey("officials.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    # Message left by the office for the student (e.g. correction instructions)
    message = Column(Text, nullable=True)
    # When the clearance first became available for review
    opened_at = Column(DateTime(timezone=True), nullable=True)
    # When a final decision was recorded
    completed_at = Column(DateTime(timezone=True), nullable=True)
    last_transition_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    # Incremented on every status change for optimistic concurrency
    version = Column(Integer, nullable=False, default=0)

    application = relationship("Application", back_populates="clearances")
    office_role = relationship("Role", foreign_keys=[office_role_id])
    reviewed_by = relationship(
        "Official",
        back_populates="reviewed_clearances",
        foreign_keys=[reviewed_by_official_id],
    )


class ClearanceDependency(Base):
    """
    Defines which clearance must be approved before another becomes available.

    This is a workflow template table — it holds the rules, not the per-application
    state. These rows are seeded once and rarely change.

    Example row:
      clearance_key = 'business_office'
      depends_on_clearance_key = 'financial_aid'
      unlock_on_status = 'approved'
      residential_only = False

    This means: Business Office becomes ready only after Financial Aid is approved,
    and this applies to all students (not just residential ones).

    residential_only = True means the dependency only applies to residential students.
    For commuter students, that dependency row is ignored.
    """

    __tablename__ = "clearance_dependencies"
    __table_args__ = (
        Index("ix_clearance_deps_key", "clearance_key"),
        CheckConstraint(
            "clearance_key <> depends_on_clearance_key",
            name="ck_clearance_deps_not_self",
        ),
        CheckConstraint(
            "unlock_on_status IN ('approved')",
            name="ck_clearance_deps_unlock_status",
        ),
    )

    # Composite primary key: (clearance_key, depends_on_clearance_key)
    clearance_key = Column(Text, primary_key=True)
    depends_on_clearance_key = Column(Text, primary_key=True)
    # Only 'approved' is supported for now
    unlock_on_status = Column(String, nullable=False, default="approved")
    # True means this dependency only applies to residential students
    residential_only = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
