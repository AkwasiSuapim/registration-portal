import uuid

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Official(Base):
    """
    Stores the office staff profile linked to a User account.

    staff_email is the official's work email (must end in @livingstone.edu).
    The office role this person holds is stored in users.role_id, not here.
    That design ensures officials cannot change their own role — only an admin
    can update the role through the users table.
    """

    __tablename__ = "officials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Staff email matches users.email but is stored here for convenience
    staff_email = Column(String(255), nullable=False, unique=True)
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    office_phone = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="official")

    # Clearances this official has reviewed
    reviewed_clearances = relationship(
        "Clearance",
        back_populates="reviewed_by",
        foreign_keys="Clearance.reviewed_by_official_id",
    )
