"""
Admin schemas — user directory, account creation/editing, office
assignment, and the admin dashboard summary. See app/api/routes/admin.py.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.enums import OfficeKey

STUDENT_ID_PATTERN = r"^100[0-9]{6}$"
STUDENT_EMAIL_SUFFIX = "@student.livingstone.edu"
STAFF_EMAIL_SUFFIX = "@livingstone.edu"


def _normalize_email(value: str) -> str:
    return value.strip().lower()


# ---------------------------------------------------------------------------
# Account creation
# ---------------------------------------------------------------------------

class AdminStudentCreate(BaseModel):
    student_id: str = Field(..., description="9-digit student number, e.g. 100123456.")
    first_name: str
    last_name: str
    school_email: EmailStr
    classification: str | None = None
    major: str | None = None
    residency_type: str = "residential"
    # If omitted, the backend generates one and returns it once in the
    # response — it is never stored in plain text and never returned again.
    temporary_password: str | None = None
    is_active: bool = True

    @field_validator("student_id")
    @classmethod
    def valid_student_id(cls, v: str) -> str:
        import re
        v = v.strip()
        if not re.match(STUDENT_ID_PATTERN, v):
            raise ValueError("Student ID must be '100' followed by 6 digits (e.g. 100123456).")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip()

    @field_validator("school_email")
    @classmethod
    def valid_student_email(cls, v: str) -> str:
        v = _normalize_email(str(v))
        if not v.endswith(STUDENT_EMAIL_SUFFIX):
            raise ValueError(f"Student college email must end with {STUDENT_EMAIL_SUFFIX}.")
        return v

    @field_validator("residency_type")
    @classmethod
    def valid_residency(cls, v: str) -> str:
        if v not in ("residential", "commuter"):
            raise ValueError("residency_type must be 'residential' or 'commuter'.")
        return v

    @field_validator("temporary_password")
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 8:
            raise ValueError("Temporary password must be at least 8 characters.")
        return v


class AdminOfficialCreate(BaseModel):
    first_name: str
    last_name: str
    school_email: EmailStr
    primary_office: OfficeKey
    office_phone: str | None = None
    temporary_password: str | None = None
    is_active: bool = True

    @field_validator("first_name", "last_name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip()

    @field_validator("school_email")
    @classmethod
    def valid_staff_email(cls, v: str) -> str:
        v = _normalize_email(str(v))
        if v.endswith(STUDENT_EMAIL_SUFFIX) or not v.endswith(STAFF_EMAIL_SUFFIX):
            raise ValueError(
                f"Staff college email must end with {STAFF_EMAIL_SUFFIX} (not a student address)."
            )
        return v

    @field_validator("temporary_password")
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 8:
            raise ValueError("Temporary password must be at least 8 characters.")
        return v


class AdminUserCreateResponse(BaseModel):
    id: UUID  # the profile id (Student.id or Official.id)
    user_id: UUID
    account_type: str
    temporary_password: str
    message: str = (
        "Share this temporary password with the account holder through a secure channel. "
        "It will not be shown again."
    )


# ---------------------------------------------------------------------------
# Editing
# ---------------------------------------------------------------------------

class AdminUserUpdate(BaseModel):
    """
    All fields optional — PATCH semantics. Which fields apply depends on
    the target account's account_type (checked server-side): major,
    classification, and residency_type only apply to students;
    office_phone only applies to officials. is_active is accepted here
    too, but the dedicated activate/deactivate endpoints are preferred
    since they produce a clearer audit trail.
    """
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    classification: str | None = None
    major: str | None = None
    residency_type: str | None = None
    office_phone: str | None = None
    is_active: bool | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("This field cannot be empty.")
        return v.strip() if v else v

    @field_validator("residency_type")
    @classmethod
    def valid_residency(cls, v: str | None) -> str | None:
        if v is not None and v not in ("residential", "commuter"):
            raise ValueError("residency_type must be 'residential' or 'commuter'.")
        return v


class OfficeAssignmentUpdate(BaseModel):
    office: OfficeKey


# ---------------------------------------------------------------------------
# User directory (GET /admin/users)
# ---------------------------------------------------------------------------

class AdminUserListItem(BaseModel):
    id: UUID              # Student.id or Official.id
    user_id: UUID
    account_type: str     # 'student' | 'official'
    first_name: str
    last_name: str
    id_number: str | None  # student_no for students; None for officials (no human-readable ID field)
    email: str
    role_name: str
    office: OfficeKey | None  # officials only
    is_active: bool
    updated_at: datetime
    latest_application_id: UUID | None = None  # students only


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Dashboard summary (GET /admin/dashboard/summary)
# ---------------------------------------------------------------------------

class OfficeProgressItem(BaseModel):
    role_key: str
    role_name: str
    office: OfficeKey
    ready: int
    pending: int
    completed: int


class AttentionApplicationItem(BaseModel):
    application_id: UUID
    application_number: str
    student_name: str
    overall_status: str
    current_step: str | None
    updated_at: datetime


class RecentActivityItem(BaseModel):
    id: int
    occurred_at: datetime
    action: str
    success: bool
    application_id: UUID | None
    student_name: str | None


class AdminDashboardSummaryResponse(BaseModel):
    total_students: int
    active_officials: int
    registrations_in_progress: int
    completed_registrations: int
    blocked_applications: int
    pending_clearances: int
    registration_progress_by_office: list[OfficeProgressItem]
    recent_activity: list[RecentActivityItem]
    applications_requiring_attention: list[AttentionApplicationItem]
