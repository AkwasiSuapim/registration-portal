import uuid

from sqlalchemy import (
    Column, String, Text, Integer, BigInteger, DateTime,
    ForeignKey, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Document(Base):
    """
    Tracks a file uploaded by a student as part of their registration.

    Files are stored on disk (or S3 later). This table stores metadata only —
    the actual file bytes are never put in the database.

    stored_filename is a safe, randomly generated name. The original name
    the student used is preserved in original_filename for display purposes.

    supersedes_document_id links to a previous version of this document
    when a student re-uploads a corrected file.

    virus_scan_status starts as 'pending' and is updated by a background
    scanner (to be added in a later phase).
    """

    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_app_type_status", "application_id", "document_type", "status"),
        Index("ix_documents_uploader", "uploaded_by_user_id"),
        Index("ix_documents_checksum", "checksum_sha256"),
        CheckConstraint(
            "storage_backend IN ('local', 's3')",
            name="ck_documents_storage_backend",
        ),
        CheckConstraint("size_bytes > 0", name="ck_documents_size_positive"),
        CheckConstraint(
            "status IN ('uploaded', 'approved', 'needs_correction', 'rejected')",
            name="ck_documents_status",
        ),
        CheckConstraint(
            "virus_scan_status IN ('pending', 'clean', 'infected', 'failed')",
            name="ck_documents_virus_scan_status",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    uploaded_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Category of document, e.g. 'transcript', 'photo_id', 'immunization_record'
    document_type = Column(Text, nullable=False)
    # What the student named the file on their computer
    original_filename = Column(Text, nullable=False)
    # Safe name we assign on the server so filenames cannot be used for attacks
    stored_filename = Column(Text, nullable=False)
    # 'local' for disk storage, 's3' for object storage (Phase 7+)
    storage_backend = Column(String, nullable=False, default="local")
    # Path or object key used to retrieve the file from storage
    storage_key = Column(Text, nullable=False)
    content_type = Column(String(255), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    # SHA-256 hash of the file contents for integrity checking
    checksum_sha256 = Column(String(64), nullable=True)
    status = Column(String, nullable=False, default="uploaded")
    # Increments when a student uploads a replacement for this document
    version_no = Column(Integer, nullable=False, default=1)
    virus_scan_status = Column(String, nullable=False, default="pending")
    review_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Points to the document this one replaces, if any
    supersedes_document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Extra metadata stored as JSON (e.g. page count, image dimensions)
    metadata_json = Column(JSONB, nullable=False, default=dict)

    application = relationship("Application", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by_user_id])
    # Link to the document this one supersedes
    previous_version = relationship(
        "Document",
        remote_side="Document.id",
        foreign_keys="[Document.supersedes_document_id]",
    )
