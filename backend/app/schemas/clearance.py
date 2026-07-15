from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, model_validator

_ALLOWED_ACTIONS = frozenset(
    {"approve", "request_correction", "reject", "mark_in_person_required"}
)
_MESSAGE_REQUIRED_ACTIONS = frozenset({"request_correction", "reject"})


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


class ClearanceActionRequest(BaseModel):
    action: str
    message: str | None = None

    @model_validator(mode="after")
    def validate_action_and_message(self):
        if self.action not in _ALLOWED_ACTIONS:
            raise ValueError(
                f"Invalid action '{self.action}'. "
                f"Must be one of: {', '.join(sorted(_ALLOWED_ACTIONS))}."
            )
        if self.action in _MESSAGE_REQUIRED_ACTIONS and not (self.message or "").strip():
            raise ValueError(
                f"A non-empty message is required when action is '{self.action}'."
            )
        return self


class ClearanceUpdateResponse(BaseModel):
    clearance: ClearanceResponse
    application_overall_status: str
    application_current_step: str | None
    unlocked_clearances: list[ClearanceResponse]
