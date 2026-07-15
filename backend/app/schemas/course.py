from uuid import UUID

from pydantic import BaseModel, field_validator


class CourseCreate(BaseModel):
    course_code: str
    course_title: str
    section: str | None = None
    credit_hours: int

    @field_validator("course_code", "course_title")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip()

    @field_validator("credit_hours")
    @classmethod
    def credit_hours_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Credit hours must be a positive number.")
        return v


class CourseResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    course_code: str
    course_title: str
    section: str | None
    credit_hours: float
