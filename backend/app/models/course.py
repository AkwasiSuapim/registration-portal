import uuid

from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    Index, UniqueConstraint, CheckConstraint, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Course(Base):
    """
    One course selected by a student as part of their registration application.

    A student may select many courses for a single application.
    The total credit_hours across all courses must reach at least 15
    before the application is accepted (enforced in the service layer).
    """

    __tablename__ = "courses"
    __table_args__ = (
        Index("ix_courses_application", "application_id"),
        # Prevent a student from registering the same section of a course twice
        UniqueConstraint(
            "application_id", "course_code", "section",
            name="uq_courses_app_code_section",
        ),
        CheckConstraint("credit_hours > 0", name="ck_courses_credit_hours_positive"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_code = Column(String(20), nullable=False)   # e.g. CSC101
    course_title = Column(Text, nullable=False)         # e.g. Intro to Computing
    section = Column(String(20), nullable=False)        # e.g. A, B, 01
    credit_hours = Column(Numeric(4, 1), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    application = relationship("Application", back_populates="courses")
