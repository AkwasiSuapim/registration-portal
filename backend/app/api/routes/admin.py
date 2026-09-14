"""
Admin routes — dashboard summary, user directory, account creation/
editing, activation, and office assignment. Every route here requires
deps.require_admin (role_key == 'system_admin').

Role/account-type is always forced server-side from which endpoint was
called (POST .../students always creates a student, POST .../officials
always creates an official with a role drawn only from the seven-office
OfficeKey enum) — there is no field on any request body that lets a
caller choose account_type or escalate to admin. Administrators cannot
create other administrators in this MVP; see app/scripts/seed_data.py
for how the first (and only) admin account is created.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.enums import OfficeKey
from app.database import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardSummaryResponse,
    AdminOfficialCreate,
    AdminStudentCreate,
    AdminUserCreateResponse,
    AdminUserListResponse,
    AdminUserUpdate,
    OfficeAssignmentUpdate,
)
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# PHASE A — dashboard summary
# ---------------------------------------------------------------------------

@router.get("/dashboard/summary", response_model=AdminDashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    """Real, database-backed overview metrics, per-office registration
    progress, recent activity, and applications requiring attention."""
    return admin_service.get_dashboard_summary(db)


# ---------------------------------------------------------------------------
# PHASE B — user directory and account management
# ---------------------------------------------------------------------------

@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    search: str | None = Query(None, description="Matches name, college email, or student ID."),
    role: str | None = Query(None, description="'student' or 'official'."),
    status_: str | None = Query(None, alias="status", description="'active' or 'inactive'."),
    office: OfficeKey | None = Query(None, description="Filter officials by primary office."),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    return admin_service.list_users(db, search, role, status_, office, page, page_size)


@router.post(
    "/users/students",
    response_model=AdminUserCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_student(
    data: AdminStudentCreate,
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    """Creates a student account. Always role STUDENT — see module docstring."""
    student, temp_password = admin_service.create_student(db, data, current_user.id)
    return AdminUserCreateResponse(
        id=student.id, user_id=student.user_id, account_type="student",
        temporary_password=temp_password,
    )


@router.post(
    "/users/officials",
    response_model=AdminUserCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_official(
    data: AdminOfficialCreate,
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    """Creates an official account. Always role OFFICIAL, assigned to exactly
    one of the seven canonical offices — see module docstring."""
    official, temp_password = admin_service.create_official(db, data, current_user.id)
    return AdminUserCreateResponse(
        id=official.id, user_id=official.user_id, account_type="official",
        temporary_password=temp_password,
    )


@router.patch("/users/{user_id}")
def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    user = admin_service.update_user(db, user_id, data, current_user.id)
    return {"id": str(user.id), "account_type": user.account_type, "is_active": user.is_active}


@router.post("/users/{user_id}/activate")
def activate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    user = admin_service.set_active_status(db, user_id, True, current_user.id)
    return {"id": str(user.id), "is_active": user.is_active}


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    """Deactivates (never deletes) the account. An admin cannot deactivate
    their own account through this endpoint."""
    user = admin_service.set_active_status(db, user_id, False, current_user.id)
    return {"id": str(user.id), "is_active": user.is_active}


@router.put("/officials/{official_id}/office")
def reassign_office(
    official_id: uuid.UUID,
    data: OfficeAssignmentUpdate,
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    official = admin_service.reassign_official_office(db, official_id, data.office, current_user.id)
    return {
        "id": str(official.id),
        "office": data.office.value,
        "role_name": official.user.role.role_name,
    }
