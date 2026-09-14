from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, computed_field

from app.schemas.clearance import ClearanceResponse
from app.schemas.course import CourseResponse
from app.schemas.document import DocumentResponse


class StudentSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    student_no: str
    first_name: str
    last_name: str
    livingstone_email: str
    residency_type: str


class OfficialQueueItemResponse(BaseModel):
    application_id: UUID
    application_number: str
    student_name: str
    student_no: str
    term_code: str
    academic_year: str
    major: str
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


class ApplicationReviewResponse(BaseModel):
    """Full application view returned to officials and admins for review."""

    model_config = {"from_attributes": True}

    id: UUID
    application_number: str
    # Nullable: an admin's Student Record link could in principle resolve
    # to a not-yet-submitted draft (overall_status='draft', created via
    # POST /registrations) — see app/schemas/application.py
    # ApplicationResponse for the same reasoning.
    term_code: str | None
    academic_year: str | None
    major: str | None
    classification: str | None
    housing_required: bool
    overall_status: str
    current_step: str | None
    submitted_at: datetime | None
    student: StudentSummary
    courses: list[CourseResponse]
    clearances: list[ClearanceResponse]
    documents: list[DocumentResponse]

    @computed_field
    @property
    def total_credit_hours(self) -> float:
        return sum(float(c.credit_hours) for c in self.courses)
