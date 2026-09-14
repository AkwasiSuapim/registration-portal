"""
Registration service — the incremental draft-save wizard API (PHASE C).

An Application moves through: draft -> in_progress -> ... same clearance
workflow as before. While overall_status == 'draft', section saves are
allowed and no clearances exist yet; POST submit validates the required
fields, creates the seven clearances (workflow_service, unchanged), and
from that point on the application behaves exactly like one created
through the legacy POST /applications endpoint.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.course import Course
from app.models.student import Student
from app.schemas.course import CourseCreate
from app.schemas.registration import SECTION_KEYS
from app.services import application_service, audit_service, notification_service
from app.services.workflow_service import (
    build_public_safety_instruction,
    create_default_clearances_for_application,
)

MIN_CREDIT_HOURS = 15


def _load(db: Session, application_id) -> Application | None:
    return (
        db.query(Application)
        .options(joinedload(Application.courses), joinedload(Application.clearances))
        .filter_by(id=application_id)
        .first()
    )


def get_owned_application(db: Session, student: Student, application_id: uuid.UUID) -> Application:
    """Returns the application only if it belongs to this student. 404 otherwise
    (never 403) so ownership is never confirmed/denied to a non-owner."""
    app = _load(db, application_id)
    if app is None or app.student_id != student.id:
        raise HTTPException(status_code=404, detail="Registration not found.")
    return app


def get_current_draft(db: Session, student: Student) -> Application | None:
    return (
        db.query(Application)
        .options(joinedload(Application.courses), joinedload(Application.clearances))
        .filter_by(student_id=student.id, overall_status="draft")
        .order_by(Application.created_at.desc())
        .first()
    )


def get_or_create_draft(db: Session, student: Student) -> tuple[Application, bool]:
    """Returns (application, created). Idempotent — a student only ever has
    one open draft; calling POST /registrations again just returns it."""
    existing = get_current_draft(db, student)
    if existing is not None:
        return existing, False

    app_number = application_service.generate_application_number(db)
    application = Application(
        student_id=student.id,
        application_number=app_number,
        housing_required=True,
        overall_status="draft",
        current_step="draft",
        submitted_at=None,
        section_data={},
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application, True


def get_history(db: Session, student: Student) -> list[Application]:
    return (
        db.query(Application)
        .options(joinedload(Application.courses), joinedload(Application.clearances))
        .filter_by(student_id=student.id)
        .filter(Application.overall_status != "draft")
        .order_by(Application.submitted_at.desc())
        .all()
    )


def save_section(db: Session, application: Application, section: str, payload: dict) -> Application:
    if section not in SECTION_KEYS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown section '{section}'. Must be one of: {', '.join(SECTION_KEYS)}.",
        )
    if application.overall_status != "draft":
        raise HTTPException(
            status_code=409,
            detail="This registration has already been submitted and its sections can no longer be edited.",
        )

    remaining = dict(payload)

    if section == "success_center":
        if "major" in remaining:
            major = str(remaining.pop("major") or "").strip()
            application.major = major or None
        if "classification" in remaining:
            classification = str(remaining.pop("classification") or "").strip()
            application.classification = classification or None
        if "courses" in remaining:
            raw_courses = remaining.pop("courses") or []
            try:
                parsed = [CourseCreate(**c) for c in raw_courses]
            except ValidationError as exc:
                raise HTTPException(status_code=422, detail=exc.errors())
            db.query(Course).filter_by(application_id=application.id).delete()
            for c in parsed:
                db.add(Course(
                    application_id=application.id,
                    course_code=c.course_code,
                    course_title=c.course_title,
                    section=c.section or "",
                    credit_hours=Decimal(str(c.credit_hours)),
                ))
        if "term_code" in remaining:
            application.term_code = str(remaining.pop("term_code") or "").strip() or None
        if "academic_year" in remaining:
            application.academic_year = str(remaining.pop("academic_year") or "").strip() or None

    elif section == "residence_life":
        if "housing_required" in remaining:
            application.housing_required = bool(remaining.pop("housing_required"))
        elif "housingStatus" in remaining:
            status_value = remaining.pop("housingStatus")
            application.housing_required = status_value == "on-campus"

    application.section_data = {**(application.section_data or {}), section: remaining}

    db.commit()
    db.refresh(application)
    return application


def _validate_ready_to_submit(application: Application) -> list[str]:
    errors = []
    if not application.term_code:
        errors.append("Term is required (save it from the Success Center section).")
    if not application.academic_year:
        errors.append("Academic year is required (save it from the Success Center section).")
    if not application.major:
        errors.append("Major is required (save it from the Success Center section).")
    if not application.classification:
        errors.append("Classification is required (save it from the Success Center section).")
    total_credits = application_service.calculate_total_credit_hours(application.courses)
    if total_credits < MIN_CREDIT_HOURS:
        errors.append(
            f"You must select at least {MIN_CREDIT_HOURS} credit hours before submitting "
            f"(currently {total_credits})."
        )
    return errors


def submit_registration(db: Session, application: Application, actor_user_id) -> tuple[Application, dict | None]:
    if application.overall_status != "draft":
        raise HTTPException(status_code=409, detail="This registration has already been submitted.")

    errors = _validate_ready_to_submit(application)
    if errors:
        # Wrapped as {"msg": ...} per item (matching Pydantic's own
        # validation-error shape) so the frontend's shared error
        # formatter (api.js extractErrorMessage), which already knows
        # how to join a list of {msg} objects, renders this exactly
        # like any other array-detail 422 — and the raw list survives
        # on ApiError.detail.detail for a caller that wants to show
        # each message separately instead of one joined string.
        raise HTTPException(status_code=422, detail=[{"msg": e} for e in errors])

    now = datetime.now(timezone.utc)
    application.overall_status = "in_progress"
    application.current_step = "registrar_check_in"
    application.submitted_at = now

    create_default_clearances_for_application(db, application)

    # application.courses are SQLAlchemy rows (Numeric -> Decimal), unlike
    # the legacy create_student_application path which sums Pydantic
    # CourseCreate.credit_hours (plain int) — cast to float so this is
    # JSON-serializable for the audit log's JSONB column.
    total_credits = float(application_service.calculate_total_credit_hours(application.courses))
    audit_service.create_audit_log(
        db=db,
        actor_user_id=actor_user_id,
        application_id=application.id,
        action="application_submitted",
        details={
            "application_number": application.application_number,
            "term_code": application.term_code,
            "academic_year": application.academic_year,
            "total_credit_hours": total_credits,
            "housing_required": application.housing_required,
        },
    )
    notification_service.create_role_notification(
        db=db,
        recipient_role_key="registrar",
        application_id=application.id,
        title="New registration application ready for Registrar Check-In",
        body="A new student registration application has been submitted and is ready for Registrar Check-In.",
        event_type="application_submitted",
    )

    db.commit()

    application = _load(db, application.id)
    public_safety = next((c for c in application.clearances if c.clearance_key == "public_safety"), None)
    instruction = build_public_safety_instruction(public_safety)
    return application, instruction


def get_public_safety_instruction(application: Application) -> dict | None:
    public_safety = next((c for c in application.clearances if c.clearance_key == "public_safety"), None)
    return build_public_safety_instruction(public_safety)
