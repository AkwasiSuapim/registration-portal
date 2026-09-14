import uuid

from sqlalchemy import (
    Column, String, Text, Boolean, Integer,
    DateTime, ForeignKey, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Application(Base):
    """
    One registration application submitted by a student for a given term.

    overall_status is a denormalized summary recalculated every time a
    clearance changes. The clearances table is the source of truth.
    overall_status is kept here so the dashboard and portal can read
    status without joining through clearances every time.

    current_step tracks which office is actively working on the application.

    housing_required determines the clearance workflow:
      True  → Residence Life clearance is required before Public Safety
      False → Residence Life is skipped; Public Safety follows Business Office
    """

    __tablename__ = "applications"
    __table_args__ = (
        Index("ix_applications_student_submitted", "student_id", "submitted_at"),
        Index("ix_applications_status_step", "overall_status", "current_step"),
        CheckConstraint(
            "overall_status IN ("
            "'draft', 'in_progress', 'correction_required', 'rejected', "
            "'in_person_required', 'fully_registered')",
            name="ck_applications_overall_status",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Human-readable application reference number, e.g. APP-20240901-1234
    application_number = Column(String(30), nullable=False, unique=True)
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Nullable so a draft (POST /registrations, before any wizard section
    # has been saved) can exist without these — they are required by the
    # time POST /registrations/{id}/submit finalizes the application. The
    # legacy POST /applications path still supplies all of these at
    # creation time, same as before.
    term_code = Column(String(20), nullable=True)       # e.g. FA2024
    academic_year = Column(String(9), nullable=True)    # e.g. 2024-2025
    major = Column(Text, nullable=True)
    classification = Column(Text, nullable=True)
    housing_required = Column(Boolean, nullable=False, default=True)
    overall_status = Column(String, nullable=False, default="in_progress")
    current_step = Column(String, nullable=False, default="registrar_check_in")
    # Free-form per-wizard-step data that has no dedicated column (contact
    # info, emergency contact, presidential-scholar answers, housing hall
    # selection, etc). Keyed by section name — see
    # app/schemas/registration.py SECTION_KEYS. Structured fields that DO
    # drive real workflow logic (major, classification, housing_required,
    # courses) are written to their real columns/table instead of here.
    section_data = Column(JSONB, nullable=False, default=dict)
    # No server_default: a draft (POST /registrations) must get a real
    # NULL here, and the two creation paths (application_service.py's
    # legacy one-shot create, registration_service.py's submit step)
    # both set this explicitly instead.
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    # Optimistic concurrency version — incremented on every update
    version = Column(Integer, nullable=False, default=1)

    student = relationship("Student", back_populates="applications")
    courses = relationship(
        "Course",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    # passive_deletes tells SQLAlchemy to let the DB's ON DELETE CASCADE
    # handle document rows rather than trying to nullify application_id first.
    documents = relationship("Document", back_populates="application", passive_deletes=True)
    clearances = relationship(
        "Clearance",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    notifications = relationship("Notification", back_populates="application")
