"""Notification routes — reading and marking in-app notifications."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.models.user import User
from app.schemas.notification import (
    BulkMarkReadResponse,
    MarkNotificationReadResponse,
    NotificationCountResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    notifications = notification_service.get_notifications_for_user(
        db, current_user, unread_only=unread_only, limit=limit, offset=offset,
    )
    counts = notification_service.get_unread_notification_count(db, current_user)
    return NotificationListResponse(
        notifications=notifications,
        unread_count=counts["unread_count"],
        total_count=counts["total_count"],
    )


@router.get("/unread-count", response_model=NotificationCountResponse)
def get_unread_count(
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    counts = notification_service.get_unread_notification_count(db, current_user)
    return NotificationCountResponse(**counts)


@router.patch("/read-all", response_model=BulkMarkReadResponse)
def mark_all_read(
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    count = notification_service.mark_all_notifications_as_read(db, current_user)
    return BulkMarkReadResponse(
        marked_read_count=count,
        message=f"{count} notification(s) marked as read.",
    )


@router.patch("/{notification_id}/read", response_model=MarkNotificationReadResponse)
def mark_one_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(get_db),
):
    notification = notification_service.mark_notification_as_read(
        db, current_user, notification_id,
    )
    return MarkNotificationReadResponse(
        notification=NotificationResponse.model_validate(notification),
        message="Notification marked as read.",
    )
