"""
Schemas for the /official/* workspace routes (PHASE F). Additive to the
existing /officials/me/queue + /clearances/{id} routes (app/schemas/official.py,
app/schemas/clearance.py) — these give the same data plus the new
claim/unclaim capability, and a decision endpoint that derives which
clearance to act on from the caller's own office instead of requiring a
clearance_id in the request body.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

_ALLOWED_ACTIONS = frozenset(
    {"approve", "request_correction", "reject", "mark_in_person_required"}
)
_MESSAGE_REQUIRED_ACTIONS = frozenset({"request_correction", "reject"})


class OfficialQueueItem(BaseModel):
    application_id: UUID
    application_number: str
    student_name: str
    student_no: str
    term_code: str | None
    academic_year: str | None
    major: str | None
    classification: str | None
    housing_required: bool
    overall_status: str
    clearance_id: UUID
    clearance_key: str
    clearance_label: str
    clearance_status: str
    clearance_availability: str
    blocked_reason: str | None
    submitted_at: datetime | None
    claimed_by_official_id: UUID | None
    claimed_by_me: bool
    claimed_at: datetime | None


class OfficialDashboardResponse(BaseModel):
    office: str
    role_name: str
    new_count: int
    ready_count: int          # unclaimed + ready
    claimed_by_me_count: int
    completed_count: int
    total_open_count: int


class ClaimResponse(BaseModel):
    clearance_id: UUID
    claimed_by_official_id: UUID | None
    claimed_at: datetime | None
    message: str


class OfficialDecisionRequest(BaseModel):
    action: str
    message: str | None = None

    @field_validator("action")
    @classmethod
    def valid_action(cls, v: str) -> str:
        if v not in _ALLOWED_ACTIONS:
            raise ValueError(
                f"Invalid action '{v}'. Must be one of: {', '.join(sorted(_ALLOWED_ACTIONS))}."
            )
        return v

    def require_message(self) -> None:
        if self.action in _MESSAGE_REQUIRED_ACTIONS and not (self.message or "").strip():
            raise ValueError(f"A non-empty message is required when action is '{self.action}'.")
