"""Audit routes — application activity history and admin audit log access."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.models.user import User
from app.schemas.audit import ApplicationActivityResponse, AuditLogResponse
from app.services import audit_service

router = APIRouter(tags=["Audit"])


@router.get("/applications/{application_id}/activity", response_model=ApplicationActivityResponse)
def get_application_activity(
    application_id: uuid.UUID,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    logs = audit_service.get_application_audit_history(
        db, current_user, application_id, limit=limit, offset=offset,
    )
    activity = [AuditLogResponse.from_audit_log(log) for log in logs]
    return ApplicationActivityResponse(
        application_id=application_id,
        activity=activity,
        total_count=len(activity),
    )


@router.get("/admin/audit-logs", response_model=list[AuditLogResponse])
def get_admin_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(deps.require_admin),
    db: Session = Depends(get_db),
):
    logs = audit_service.get_all_audit_logs(db, limit=limit, offset=offset)
    return [AuditLogResponse.from_audit_log(log) for log in logs]
