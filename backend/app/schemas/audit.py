from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    occurred_at: datetime
    actor_user_id: UUID | None
    actor_role_id: int | None
    application_id: UUID | None
    entity_type: str | None
    entity_id: UUID | None
    action: str
    success: bool
    details: dict | None

    @classmethod
    def from_audit_log(cls, log) -> "AuditLogResponse":
        return cls(
            id=log.id,
            occurred_at=log.occurred_at,
            actor_user_id=log.actor_user_id,
            actor_role_id=log.actor_role_id,
            application_id=log.application_id,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            action=log.action,
            success=log.success,
            details=log.after_state_json,
        )


class ApplicationActivityResponse(BaseModel):
    application_id: UUID
    activity: list[AuditLogResponse]
    total_count: int
