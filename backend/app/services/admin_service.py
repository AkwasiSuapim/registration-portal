"""
Admin service — dashboard summary, user directory, account creation/
editing, activation, and office assignment. Every function here is
admin-only business logic; the routes in app/api/routes/admin.py just
authenticate/authorize and translate HTTP <-> these calls.

Security invariants enforced here (not just in the route layer):
  - create_student always creates account_type='student', role 'student'.
  - create_official always creates account_type='official', and the role
    is resolved ONLY from the OfficeKey enum (see app/core/enums.py) —
    there is no code path from a client payload to role_id='system_admin'.
  - Neither creation function, nor update_user, ever accepts or writes a
    password hash directly — passwords only ever go through
    app.core.security.hash_password.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.enums import OfficeKey, require_office_role
from app.core.security import generate_temporary_password, hash_password
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.clearance import Clearance
from app.models.official import Official
from app.models.role import Role
from app.models.student import Student
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardSummaryResponse,
    AdminOfficialCreate,
    AdminStudentCreate,
    AdminUserListItem,
    AdminUserListResponse,
    AdminUserUpdate,
    AttentionApplicationItem,
    OfficeProgressItem,
    RecentActivityItem,
)
from app.services import audit_service

STUDENT_EMAIL_SUFFIX = "@student.livingstone.edu"

# The seven office roles, in workflow order — reused for both the
# dashboard's per-office breakdown and anywhere else a fixed office list
# is needed server-side.
_OFFICE_ROLE_KEYS = [
    "registrar", "health_services", "success_center", "financial_aid",
    "business_office", "residence_life", "public_safety",
]

_BLOCKED_STATUSES = ("correction_required", "rejected")
_TERMINAL_STATUSES = ("fully_registered", "rejected")


# ---------------------------------------------------------------------------
# Dashboard summary (PHASE A)
# ---------------------------------------------------------------------------

def get_dashboard_summary(db: Session, recent_limit: int = 10, attention_limit: int = 25) -> AdminDashboardSummaryResponse:
    total_students = db.query(Student).count()
    active_officials = (
        db.query(User).filter_by(account_type="official", is_active=True).count()
    )
    registrations_in_progress = (
        db.query(Application)
        .filter(~Application.overall_status.in_(_TERMINAL_STATUSES + ("draft",)))
        .count()
    )
    completed_registrations = (
        db.query(Application).filter_by(overall_status="fully_registered").count()
    )
    blocked_applications = (
        db.query(Application).filter(Application.overall_status.in_(_BLOCKED_STATUSES)).count()
    )
    pending_clearances = (
        db.query(Clearance).filter(Clearance.availability.in_(("ready", "needs_student_action"))).count()
    )

    roles_by_key = {r.role_key: r for r in db.query(Role).filter(Role.role_key.in_(_OFFICE_ROLE_KEYS)).all()}
    progress_by_office = []
    for role_key in _OFFICE_ROLE_KEYS:
        role = roles_by_key.get(role_key)
        if role is None:
            continue
        clearances = db.query(Clearance).filter_by(office_role_id=role.id).all()
        ready = sum(1 for c in clearances if c.availability == "ready")
        completed = sum(1 for c in clearances if c.availability == "completed")
        pending = len(clearances) - ready - completed
        office = OfficeKey.from_role_key(role_key)
        progress_by_office.append(OfficeProgressItem(
            role_key=role_key, role_name=role.role_name, office=office,
            ready=ready, pending=pending, completed=completed,
        ))

    recent_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.occurred_at.desc())
        .limit(recent_limit)
        .all()
    )
    recent_activity = [_build_recent_activity_item(db, log) for log in recent_logs]

    attention_apps = (
        db.query(Application)
        .options(joinedload(Application.student))
        .filter(Application.overall_status.in_(_BLOCKED_STATUSES))
        .order_by(Application.updated_at.desc())
        .limit(attention_limit)
        .all()
    )
    attention_items = [
        AttentionApplicationItem(
            application_id=app.id,
            application_number=app.application_number,
            student_name=f"{app.student.first_name} {app.student.last_name}",
            overall_status=app.overall_status,
            current_step=app.current_step,
            updated_at=app.updated_at,
        )
        for app in attention_apps
    ]

    return AdminDashboardSummaryResponse(
        total_students=total_students,
        active_officials=active_officials,
        registrations_in_progress=registrations_in_progress,
        completed_registrations=completed_registrations,
        blocked_applications=blocked_applications,
        pending_clearances=pending_clearances,
        registration_progress_by_office=progress_by_office,
        recent_activity=recent_activity,
        applications_requiring_attention=attention_items,
    )


def _build_recent_activity_item(db: Session, log: AuditLog) -> RecentActivityItem:
    student_name = None
    if log.application_id:
        app = db.query(Application).options(joinedload(Application.student)).filter_by(id=log.application_id).first()
        if app and app.student:
            student_name = f"{app.student.first_name} {app.student.last_name}"
    return RecentActivityItem(
        id=log.id, occurred_at=log.occurred_at, action=log.action, success=log.success,
        application_id=log.application_id, student_name=student_name,
    )


# ---------------------------------------------------------------------------
# User directory (PHASE B — GET /admin/users)
# ---------------------------------------------------------------------------

def list_users(
    db: Session,
    search: str | None,
    role: str | None,
    status_filter: str | None,
    office: OfficeKey | None,
    page: int,
    page_size: int,
) -> AdminUserListResponse:
    """
    Students and Officials are two separate 1:1-linked tables, so a single
    SQL query can't cleanly page across both while sorting/filtering on
    profile-specific columns. At MVP/college scale (hundreds, not
    millions, of accounts) it's simpler and just as correct to load every
    matching account_type row with its profile eagerly joined, then
    filter/search/paginate in Python. This is called out as a scale
    tradeoff, not an oversight.
    """
    query = (
        db.query(User)
        .options(joinedload(User.student), joinedload(User.official), joinedload(User.role))
        .filter(User.account_type.in_(["student", "official"]))
    )
    if role in ("student", "official"):
        query = query.filter(User.account_type == role)
    if status_filter == "active":
        query = query.filter(User.is_active.is_(True))
    elif status_filter == "inactive":
        query = query.filter(User.is_active.is_(False))
    if office is not None:
        query = query.join(Role, User.role_id == Role.id).filter(Role.role_key == office.role_key)

    users = query.all()

    # Batch-fetch each student's most recent application id (avoids N+1).
    student_ids = [u.student.id for u in users if u.student is not None]
    latest_app_by_student: dict[uuid.UUID, uuid.UUID] = {}
    if student_ids:
        apps = (
            db.query(Application.student_id, Application.id, Application.submitted_at)
            .filter(Application.student_id.in_(student_ids))
            # Excludes drafts (POST /registrations, not yet submitted) —
            # NULL submitted_at would otherwise sort first in Postgres'
            # default DESC-NULLS-FIRST ordering and get picked as
            # "latest", pointing View at an application with no
            # clearances/documents yet instead of the student's real
            # most recent registration.
            .filter(Application.overall_status != "draft")
            .order_by(Application.submitted_at.desc())
            .all()
        )
        for student_id, app_id, _submitted_at in apps:
            latest_app_by_student.setdefault(student_id, app_id)

    items: list[AdminUserListItem] = []
    for user in users:
        if user.account_type == "student" and user.student:
            profile = user.student
            items.append(AdminUserListItem(
                id=profile.id, user_id=user.id, account_type="student",
                first_name=profile.first_name, last_name=profile.last_name,
                id_number=profile.student_no, email=profile.livingstone_email,
                role_name=user.role.role_name, office=None,
                is_active=user.is_active, updated_at=profile.updated_at,
                latest_application_id=latest_app_by_student.get(profile.id),
            ))
        elif user.account_type == "official" and user.official:
            profile = user.official
            items.append(AdminUserListItem(
                id=profile.id, user_id=user.id, account_type="official",
                first_name=profile.first_name, last_name=profile.last_name,
                id_number=None, email=profile.staff_email,
                role_name=user.role.role_name,
                office=OfficeKey.from_role_key(user.role.role_key),
                is_active=user.is_active, updated_at=profile.updated_at,
            ))

    if search:
        needle = search.strip().lower()
        if needle:
            items = [
                item for item in items
                if needle in f"{item.first_name} {item.last_name}".lower()
                or needle in item.email.lower()
                or (item.id_number and needle in item.id_number.lower())
            ]

    items.sort(key=lambda i: (i.last_name.lower(), i.first_name.lower()))

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start:start + page_size]

    return AdminUserListResponse(items=page_items, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Account creation (PHASE B)
# ---------------------------------------------------------------------------

def create_student(db: Session, data: AdminStudentCreate, actor_user_id) -> tuple[Student, str]:
    if db.query(Student).filter_by(student_no=data.student_id).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A student with this student ID already exists.")
    if db.query(Student).filter_by(livingstone_email=data.school_email).first() or \
       db.query(User).filter_by(email=data.school_email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this college email already exists.")

    role = db.query(Role).filter_by(role_key="student").first()
    if role is None:
        raise HTTPException(500, "The 'student' role is not seeded. Run: python -m app.scripts.seed_data")

    temp_password = data.temporary_password or generate_temporary_password()

    user = User(
        email=data.school_email,
        password_hash=hash_password(temp_password),
        account_type="student",
        role_id=role.id,
        is_active=data.is_active,
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    student = Student(
        user_id=user.id,
        student_no=data.student_id,
        livingstone_email=data.school_email,
        first_name=data.first_name,
        last_name=data.last_name,
        classification=data.classification,
        major=data.major,
        residency_type=data.residency_type,
    )
    db.add(student)
    db.flush()

    audit_service.create_audit_log(
        db=db, actor_user_id=actor_user_id, application_id=None,
        action="admin_created_student",
        details={"student_id": data.student_id, "email": data.school_email},
    )
    db.commit()
    db.refresh(student)
    return student, temp_password


def create_official(db: Session, data: AdminOfficialCreate, actor_user_id) -> tuple[Official, str]:
    if db.query(Official).filter_by(staff_email=data.school_email).first() or \
       db.query(User).filter_by(email=data.school_email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this college email already exists.")

    role = require_office_role(db, data.primary_office)
    temp_password = data.temporary_password or generate_temporary_password()

    user = User(
        email=data.school_email,
        password_hash=hash_password(temp_password),
        account_type="official",
        role_id=role.id,
        is_active=data.is_active,
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    official = Official(
        user_id=user.id,
        staff_email=data.school_email,
        first_name=data.first_name,
        last_name=data.last_name,
        office_phone=data.office_phone,
    )
    db.add(official)
    db.flush()

    audit_service.create_audit_log(
        db=db, actor_user_id=actor_user_id, application_id=None,
        action="admin_created_official",
        details={"email": data.school_email, "office": data.primary_office.value},
    )
    db.commit()
    db.refresh(official)
    return official, temp_password


# ---------------------------------------------------------------------------
# Editing (PATCH /admin/users/{id})
# ---------------------------------------------------------------------------

def _get_user_or_404(db: Session, user_id) -> User:
    user = db.query(User).filter_by(id=user_id).first()
    if user is None or user.account_type not in ("student", "official"):
        raise HTTPException(404, "User not found.")
    return user


def update_user(db: Session, user_id, data: AdminUserUpdate, actor_user_id) -> User:
    user = _get_user_or_404(db, user_id)
    student_only = ("classification", "major", "residency_type")
    official_only = ("office_phone",)

    if user.account_type == "student":
        for field in official_only:
            if getattr(data, field) is not None:
                raise HTTPException(422, f"'{field}' does not apply to a student account.")
        profile = user.student
        if data.first_name is not None:
            profile.first_name = data.first_name
        if data.last_name is not None:
            profile.last_name = data.last_name
        if data.email is not None:
            profile.livingstone_email = str(data.email).lower()
            user.email = str(data.email).lower()
        if data.classification is not None:
            profile.classification = data.classification
        if data.major is not None:
            profile.major = data.major
        if data.residency_type is not None:
            profile.residency_type = data.residency_type
    else:
        for field in student_only:
            if getattr(data, field) is not None:
                raise HTTPException(422, f"'{field}' does not apply to an official account.")
        profile = user.official
        if data.first_name is not None:
            profile.first_name = data.first_name
        if data.last_name is not None:
            profile.last_name = data.last_name
        if data.email is not None:
            profile.staff_email = str(data.email).lower()
            user.email = str(data.email).lower()
        if data.office_phone is not None:
            profile.office_phone = data.office_phone

    if data.is_active is not None:
        user.is_active = data.is_active

    audit_service.create_audit_log(
        db=db, actor_user_id=actor_user_id, application_id=None,
        action="admin_updated_user",
        details={"user_id": str(user.id), "account_type": user.account_type},
    )
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Activate / deactivate
# ---------------------------------------------------------------------------

def set_active_status(db: Session, user_id, is_active: bool, actor_user_id) -> User:
    # Checked before the student/official-only lookup below so an admin
    # gets a clear "you can't do that" instead of a misleading 404 when
    # user_id happens to be their own (admin) account.
    if user_id == actor_user_id and not is_active:
        raise HTTPException(400, "You cannot deactivate your own account.")

    user = _get_user_or_404(db, user_id)
    user.is_active = is_active
    audit_service.create_audit_log(
        db=db, actor_user_id=actor_user_id, application_id=None,
        action="admin_activated_user" if is_active else "admin_deactivated_user",
        details={"user_id": str(user.id), "account_type": user.account_type},
    )
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Office reassignment (PHASE B — PUT /admin/officials/{id}/office)
# ---------------------------------------------------------------------------

def reassign_official_office(db: Session, official_id, office: OfficeKey, actor_user_id) -> Official:
    official = db.query(Official).filter_by(id=official_id).first()
    if official is None:
        raise HTTPException(404, "Official not found.")

    new_role = require_office_role(db, office)
    old_role_key = official.user.role.role_key
    official.user.role_id = new_role.id

    audit_service.create_audit_log(
        db=db, actor_user_id=actor_user_id, application_id=None,
        action="admin_reassigned_office",
        details={
            "official_id": str(official.id),
            "before": {"office": old_role_key},
            "after": {"office": office.role_key},
        },
    )
    db.commit()
    db.refresh(official)
    return official
