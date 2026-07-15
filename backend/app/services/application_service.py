"""
Application service — orchestrates student registration application creation and retrieval.

Workflow rules are in workflow_service.py.
Audit and notification creation are in audit_service.py / notification_service.py.
This file glues those pieces together for the application submission flow.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.course import Course
from app.models.student import Student
from app.models.user import User
from app.schemas.application import ApplicationCreate
from app.services import audit_service, notification_service
from app.services.workflow_service import create_default_clearances_for_application


def calculate_total_credit_hours(courses) -> int:
    """Returns the sum of credit_hours across all course items."""
    return sum(c.credit_hours for c in courses)


def generate_application_number(db: Session) -> str:
    """
    Creates a human-readable application number in the format APP-YYYY-NNNNNN.

    The sequential number is based on the current total application count plus one.
    Simple and readable — good enough for a single-server college system.
    """
    year = datetime.now(timezone.utc).year
    count = db.query(Application).count()
    return f"APP-{year}-{count + 1:06d}"


def _load_with_relations(db: Session, application_id) -> Application | None:
    """Loads an application with its courses and clearances eagerly to avoid lazy-load issues."""
    return (
        db.query(Application)
        .options(
            joinedload(Application.courses),
            joinedload(Application.clearances),
        )
        .filter_by(id=application_id)
        .first()
    )


def create_student_application(
    db: Session,
    student: Student,
    application_data: ApplicationCreate,
    actor_user_id,
) -> Application:
    """
    Validates and creates a new registration application for a student.

    Steps:
      1. Validate course count and total credit hours (min 15).
      2. Reject duplicate applications for the same term.
      3. Create the Application row.
      4. Create one Course row per selected course.
      5. Create seven default Clearance rows (workflow_service handles the rules).
      6. Write an audit log entry.
      7. Notify the Registrar office.
      8. Commit and return the fully-loaded application.
    """
    courses = application_data.courses

    # Validate credit hours before touching the database.
    total_credits = calculate_total_credit_hours(courses)
    if total_credits < 15:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "You must select at least 15 credit hours before submitting your registration. "
                f"You currently have {total_credits} credit hour(s) selected."
            ),
        )

    # Prevent duplicate applications for the same student and academic term.
    duplicate = db.query(Application).filter_by(
        student_id=student.id,
        term_code=application_data.term_code,
        academic_year=application_data.academic_year,
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a registration application for this term.",
        )

    app_number = generate_application_number(db)

    application = Application(
        student_id=student.id,
        application_number=app_number,
        term_code=application_data.term_code,
        academic_year=application_data.academic_year,
        major=application_data.major,
        classification=application_data.classification,
        housing_required=application_data.housing_required,
        overall_status="in_progress",
        current_step="registrar_check_in",
    )
    db.add(application)
    db.flush()  # Populate application.id before creating related rows.

    for course_data in courses:
        db.add(Course(
            application_id=application.id,
            course_code=course_data.course_code,
            course_title=course_data.course_title,
            section=course_data.section or "",
            credit_hours=Decimal(str(course_data.credit_hours)),
        ))

    # Create the seven default clearances with correct initial statuses.
    # workflow_service knows which clearances are ready, locked, or not_required.
    create_default_clearances_for_application(db, application)

    audit_service.create_audit_log(
        db=db,
        actor_user_id=actor_user_id,
        application_id=application.id,
        action="application_submitted",
        details={
            "application_number": app_number,
            "term_code": application_data.term_code,
            "academic_year": application_data.academic_year,
            "total_credit_hours": total_credits,
            "housing_required": application_data.housing_required,
        },
    )

    notification_service.create_role_notification(
        db=db,
        recipient_role_key="registrar",
        application_id=application.id,
        title="New registration application ready for Registrar Check-In",
        body=(
            "A new student registration application has been submitted "
            "and is ready for Registrar Check-In."
        ),
        event_type="application_submitted",
    )

    db.commit()

    # Reload with relationships so the response schema can read courses and clearances.
    return _load_with_relations(db, application.id)


def get_student_applications(db: Session, student: Student) -> list[Application]:
    """Returns all applications for the given student, newest first."""
    return (
        db.query(Application)
        .options(
            joinedload(Application.courses),
            joinedload(Application.clearances),
        )
        .filter_by(student_id=student.id)
        .order_by(Application.submitted_at.desc())
        .all()
    )


def get_application_for_student(
    db: Session, student: Student, application_id: uuid.UUID
) -> Application:
    """
    Returns the application only if it belongs to this student.
    Returns 404 (not 403) to avoid confirming that the application exists for another user.
    """
    application = (
        db.query(Application)
        .options(
            joinedload(Application.courses),
            joinedload(Application.clearances),
        )
        .filter_by(id=application_id, student_id=student.id)
        .first()
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return application


def get_application_for_authorized_user(
    db: Session, current_user: User, application_id: uuid.UUID
) -> Application:
    """
    Returns an application if the requesting user is allowed to see it.

    Students: can only access their own application.
    Officials and admins: can access any application (for review in Phase 6).

    Uses 404 instead of 403 when a student requests another student's application,
    so the response does not confirm that the application exists.
    """
    application = (
        db.query(Application)
        .options(
            joinedload(Application.courses),
            joinedload(Application.clearances),
        )
        .filter_by(id=application_id)
        .first()
    )

    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    if current_user.account_type == "student":
        student = db.query(Student).filter_by(user_id=current_user.id).first()
        if student is None or application.student_id != student.id:
            raise HTTPException(status_code=404, detail="Application not found.")

    return application
