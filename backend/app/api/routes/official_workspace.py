"""
Official workspace routes (PHASE F) — /official/* prefix, additive to the
existing /officials/me/queue + /applications/{id}/review +
PATCH /clearances/{id} routes (still present, unchanged, still used by
the current frontend). These give richer, claim-aware data and a
decision endpoint that never needs a clearance_id from the client.

Every route derives office from deps.get_current_official /
current_user.role.role_key — never from a query parameter or request
body — so an official can never act on, or even query, another office's
queue by passing a different value.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.database import get_db
from app.models.official import Official
from app.models.user import User
from app.schemas.clearance import ClearanceResponse, ClearanceUpdateResponse
from app.schemas.official import ApplicationReviewResponse
from app.schemas.official_workspace import (
    ClaimResponse,
    OfficialDashboardResponse,
    OfficialDecisionRequest,
    OfficialQueueItem,
)
from app.services import clearance_service, official_workspace_service

router = APIRouter(prefix="/official", tags=["Official Workspace"])


@router.get("/me/dashboard", response_model=OfficialDashboardResponse)
def get_dashboard(
    current_user: User = Depends(deps.require_official),
    official: Official = Depends(deps.get_current_official),
    db: Session = Depends(get_db),
):
    return official_workspace_service.get_dashboard(
        db, official, current_user.role.role_key, current_user.role.role_name
    )


@router.get("/me/queue", response_model=list[OfficialQueueItem])
def get_queue(
    availability: str | None = Query(None),
    status: str | None = Query(None),
    current_user: User = Depends(deps.require_official),
    official: Official = Depends(deps.get_current_official),
    db: Session = Depends(get_db),
):
    return official_workspace_service.get_queue(
        db, current_user.role.role_key, official.id, availability, status
    )


@router.post("/applications/{application_id}/claim", response_model=ClaimResponse)
def claim_application(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.require_official),
    official: Official = Depends(deps.get_current_official),
    db: Session = Depends(get_db),
):
    target = official_workspace_service.resolve_own_clearance_for_application(
        db, current_user.role.role_key, application_id
    )
    clearance = official_workspace_service.claim(db, official, current_user.role.role_key, target.id)
    return ClaimResponse(
        clearance_id=clearance.id, claimed_by_official_id=clearance.claimed_by_official_id,
        claimed_at=clearance.claimed_at, message="Claimed successfully.",
    )


@router.post("/applications/{application_id}/unclaim", response_model=ClaimResponse)
def unclaim_application(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.require_official),
    official: Official = Depends(deps.get_current_official),
    db: Session = Depends(get_db),
):
    target = official_workspace_service.resolve_own_clearance_for_application(
        db, current_user.role.role_key, application_id
    )
    clearance = official_workspace_service.unclaim(db, official, current_user.role.role_key, target.id)
    return ClaimResponse(
        clearance_id=clearance.id, claimed_by_official_id=clearance.claimed_by_official_id,
        claimed_at=clearance.claimed_at, message="Unclaimed successfully.",
    )


@router.get("/applications/{application_id}", response_model=ApplicationReviewResponse)
def get_application(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.require_official_or_admin),
    db: Session = Depends(get_db),
):
    return clearance_service.get_application_for_official_review(db, application_id)


@router.post("/applications/{application_id}/decision", response_model=ClearanceUpdateResponse)
def make_decision(
    application_id: uuid.UUID,
    body: OfficialDecisionRequest,
    current_user: User = Depends(deps.require_official),
    official: Official = Depends(deps.get_current_official),
    db: Session = Depends(get_db),
):
    try:
        body.require_message()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = official_workspace_service.make_decision(
        db, official, current_user.role.role_key, application_id, body.action, body.message
    )
    return ClearanceUpdateResponse(
        clearance=ClearanceResponse.model_validate(result["clearance"]),
        application_overall_status=result["application_overall_status"],
        application_current_step=result["application_current_step"],
        unlocked_clearances=[ClearanceResponse.model_validate(c) for c in result["unlocked_clearances"]],
    )
