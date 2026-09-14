"""
Registration schemas — the incremental draft-save wizard API (PHASE C).

This is additive to, not a replacement for, the existing
POST /applications one-shot flow (see app/schemas/application.py) —
both create the same Application row and share the same clearance
workflow; /registrations just lets a student save each wizard step
separately before a final, explicit submit.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.clearance import ClearanceResponse
from app.schemas.course import CourseResponse
from app.schemas.document import DocumentResponse

# The seven frontend wizard steps. "review" has no dedicated backend
# fields of its own — saving it just stores the confirmation flag.
SECTION_KEYS = (
    "welcome_desk",
    "health_services",
    "success_center",
    "financial_aid",
    "business_office",
    "residence_life",
    "review",
)


class SectionSaveRequest(BaseModel):
    """
    Arbitrary JSON for one wizard step. Structured fields the backend
    already understands are pulled out and written to real columns:
      success_center  -> major, classification, courses[]
      residence_life  -> housing_required (bool) or housingStatus
                         ("on-campus" | "off-campus")
    Everything else in the payload (contact info, emergency contact,
    presidential-scholar answers, hall selection, etc.) is stored as-is
    in Application.section_data[section] — see that column's docstring.
    """
    data: dict[str, Any] = Field(default_factory=dict)


class PublicSafetyInstruction(BaseModel):
    office: str
    status: str
    title: str
    message: str


class RegistrationResponse(BaseModel):
    """A draft or submitted registration — nullable fields reflect an
    in-progress draft that has not reached every required section yet."""
    model_config = {"from_attributes": True}

    id: UUID
    application_number: str
    overall_status: str
    current_step: str | None
    term_code: str | None
    academic_year: str | None
    major: str | None
    classification: str | None
    housing_required: bool
    section_data: dict[str, Any]
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    courses: list[CourseResponse]
    clearances: list[ClearanceResponse]

    @property
    def is_draft(self) -> bool:
        return self.overall_status == "draft"


class RegistrationSubmitResponse(BaseModel):
    application: RegistrationResponse
    public_safety_instruction: PublicSafetyInstruction | None


class RegistrationClearancesResponse(BaseModel):
    application_id: UUID
    overall_status: str
    current_step: str | None
    clearances: list[ClearanceResponse]
    public_safety_instruction: PublicSafetyInstruction | None


class RegistrationDocumentsResponse(BaseModel):
    application_id: UUID
    documents: list[DocumentResponse]
