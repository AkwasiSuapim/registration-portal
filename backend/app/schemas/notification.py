from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    event_type: str
    title: str
    body: str
    channel: str
    is_read: bool
    read_at: datetime | None
    created_at: datetime
    application_id: UUID | None
    recipient_user_id: UUID | None
    recipient_role_id: int | None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
    total_count: int


class NotificationCountResponse(BaseModel):
    unread_count: int
    total_count: int


class MarkNotificationReadResponse(BaseModel):
    notification: NotificationResponse
    message: str


class BulkMarkReadResponse(BaseModel):
    marked_read_count: int
    message: str
