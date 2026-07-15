from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ClearanceResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    clearance_key: str
    clearance_label: str
    status: str
    availability: str
    is_required: bool
    blocked_reason: str | None
    message: str | None
    reviewed_at: datetime | None
    opened_at: datetime | None
    completed_at: datetime | None
