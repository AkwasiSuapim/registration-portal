import uuid

from sqlalchemy import (
    Column, String, Boolean, SmallInteger,
    DateTime, ForeignKey, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    """
    The core authentication record for every person in the system.

    Every student, office official, and admin has exactly one User row.
    The role_id column points to the Roles table and determines what
    this account is allowed to do — officials cannot pick their own role,
    it must be set here by an admin or seed script.

    account_type is a quick discriminator:
      'student'  — linked to a Student profile
      'official' — linked to an Official profile
      'admin'    — system administrator, no profile
    """

    __tablename__ = "users"
    __table_args__ = (
        # Composite index speeds up "find active users with a given role"
        # which is the most common auth lookup pattern.
        Index("ix_users_role_active", "role_id", "is_active"),
        CheckConstraint(
            "account_type IN ('student', 'official', 'admin')",
            name="ck_users_account_type",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Email is the login identifier for all account types.
    # We enforce lowercase + uniqueness in the application layer (Phase 4).
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    account_type = Column(String, nullable=False)
    role_id = Column(SmallInteger, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # The role this user belongs to (determines permissions)
    role = relationship("Role", back_populates="users")

    # Exactly one of these will exist depending on account_type
    student = relationship("Student", back_populates="user", uselist=False)
    official = relationship("Official", back_populates="user", uselist=False)
