from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, computed_field


class DocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    application_id: UUID
    document_type: str
    original_filename: str
    content_type: str
    size_bytes: int
    status: str
    uploaded_at: datetime
    uploaded_by_user_id: UUID
    supersedes_document_id: UUID | None

    @computed_field
    @property
    def download_url(self) -> str:
        return f"/documents/{self.id}/download"


class DocumentUploadResponse(BaseModel):
    document: DocumentResponse
    message: str
