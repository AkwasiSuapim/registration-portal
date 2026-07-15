import uuid

from sqlalchemy import (
    Column, String, Text, Boolean, Integer,
    DateTime, ForeignKey, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
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
            "'in_progress', 'correction_required', 'rejected', "
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
    term_code = Column(String(20), nullable=False)       # e.g. FA2024
    academic_year = Column(String(9), nullable=False)    # e.g. 2024-2025
    major = Column(Text, nullable=False)
    classification = Column(Text, nullable=True)
    housing_required = Column(Boolean, nullable=False, default=True)
    overall_status = Column(String, nullable=False, default="in_progress")
    current_step = Column(String, nullable=False, default="registrar_check_in")
    submitted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
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
