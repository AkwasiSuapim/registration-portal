from sqlalchemy import Column, SmallInteger, String, Boolean, CheckConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Role(Base):
    """
    Stores every role in the system — both student roles and office roles.

    role_scope tells us what category of account uses this role:
      'student'  — a student account
      'official' — a registrar or office staff account
      'admin'    — a system administrator account

    role_key is the machine-readable identifier used in code (e.g. 'financial_aid').
    role_name is the human-readable label shown in the UI (e.g. 'Financial Aid').
    """

    __tablename__ = "roles"
    __table_args__ = (
        CheckConstraint(
            "role_scope IN ('student', 'official', 'admin')",
            name="ck_roles_scope",
        ),
    )

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    role_key = Column(String, nullable=False, unique=True)
    role_name = Column(String, nullable=False, unique=True)
    role_scope = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # All user accounts assigned to this role
    users = relationship("User", back_populates="role")
