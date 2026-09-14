from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, computed_field, field_validator

from app.schemas.clearance import ClearanceResponse
from app.schemas.course import CourseCreate, CourseResponse


class ApplicationCreate(BaseModel):
    term_code: str
    academic_year: str
    major: str
    classification: str
    housing_required: bool
    courses: list[CourseCreate]

    @field_validator("term_code", "academic_year", "major", "classification")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip()

    @field_validator("courses")
    @classmethod
    def courses_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("You must select at least one course.")
        return v


class ApplicationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    application_number: str
    # Nullable because GET /students/me/applications and GET /applications/{id}
    # can now return a draft row (overall_status='draft', created via
    # POST /registrations) alongside real submitted applications — a draft
    # has none of these set until its Success Center section is saved.
    # See app/schemas/registration.py RegistrationResponse, which has the
    # same optionality for the same reason.
    term_code: str | None
    academic_year: str | None
    major: str | None
    classification: str | None
    housing_required: bool
    overall_status: str
    current_step: str | None
    submitted_at: datetime | None
    courses: list[CourseResponse]
    clearances: list[ClearanceResponse]

    # total_credit_hours is derived from the courses list so no separate DB column is needed.
    @computed_field
    @property
    def total_credit_hours(self) -> float:
        return sum(float(c.credit_hours) for c in self.courses)


class ApplicationStatusResponse(BaseModel):
    application_id: UUID
    application_number: str
    overall_status: str
    current_step: str | None
    clearances: list[ClearanceResponse]
