import uuid

from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Student(Base):
    """
    Stores the student profile linked to a User account.

    student_no is the 9-digit Livingstone student ID (e.g. 100123456).
    livingstone_email is the school-issued student email.

    residency_type determines the clearance workflow:
      'residential' — student needs Residence Life clearance before Public Safety
      'commuter'    — Residence Life is skipped; Public Safety follows Business Office
    """

    __tablename__ = "students"
    __table_args__ = (
        # These indexes support fast login lookups and application filtering.
        Index("ix_students_user_id", "user_id"),
        CheckConstraint(
            r"student_no ~ '^100[0-9]{6}$'",
            name="ck_students_student_no_format",
        ),
        CheckConstraint(
            "residency_type IN ('residential', 'commuter')",
            name="ck_students_residency_type",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # 9-digit student number, e.g. 100123456
    student_no = Column(String(9), nullable=False, unique=True)
    # School-issued student email ending in @student.livingstone.edu
    livingstone_email = Column(String(255), nullable=False, unique=True)
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    classification = Column(Text, nullable=True)   # e.g. Freshman, Sophomore
    major = Column(Text, nullable=True)
    residency_type = Column(String, nullable=False, default="residential")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="student")
    applications = relationship("Application", back_populates="student")
