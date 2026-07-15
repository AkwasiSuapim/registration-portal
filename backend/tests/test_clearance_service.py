"""
Unit tests for clearance_service and workflow_service additions.

These tests do not use a database or HTTP server.
SimpleNamespace is used to create lightweight fake objects.
"""

from types import SimpleNamespace

import pytest

from app.schemas.clearance import ClearanceActionRequest
from app.services.workflow_service import (
    get_next_current_step,
    get_role_key_for_clearance,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_clearance(key, status="pending", availability="locked", is_required=True):
    return SimpleNamespace(
        clearance_key=key,
        status=status,
        availability=availability,
        is_required=is_required,
    )


# ---------------------------------------------------------------------------
# ClearanceActionRequest validation (Pydantic schema)
# ---------------------------------------------------------------------------

class TestClearanceActionRequest:
    def test_approve_is_valid(self):
        req = ClearanceActionRequest(action="approve")
        assert req.action == "approve"

    def test_approve_with_optional_message(self):
        req = ClearanceActionRequest(action="approve", message="Looks good")
        assert req.message == "Looks good"

    def test_request_correction_requires_message(self):
        with pytest.raises(Exception):
            ClearanceActionRequest(action="request_correction")

    def test_request_correction_with_blank_message_fails(self):
        with pytest.raises(Exception):
            ClearanceActionRequest(action="request_correction", message="   ")

    def test_request_correction_with_message_is_valid(self):
        req = ClearanceActionRequest(action="request_correction", message="Missing immunization record.")
        assert req.action == "request_correction"

    def test_reject_requires_message(self):
        with pytest.raises(Exception):
            ClearanceActionRequest(action="reject")

    def test_reject_with_message_is_valid(self):
        req = ClearanceActionRequest(action="reject", message="Balance outstanding.")
        assert req.action == "reject"

    def test_mark_in_person_required_is_valid(self):
        req = ClearanceActionRequest(action="mark_in_person_required")
        assert req.action == "mark_in_person_required"

    def test_invalid_action_raises(self):
        with pytest.raises(Exception):
            ClearanceActionRequest(action="vanish")

    def test_empty_action_raises(self):
        with pytest.raises(Exception):
            ClearanceActionRequest(action="")


# ---------------------------------------------------------------------------
# get_role_key_for_clearance
# ---------------------------------------------------------------------------

class TestGetRoleKeyForClearance:
    def test_registrar_check_in_maps_to_registrar(self):
        assert get_role_key_for_clearance("registrar_check_in") == "registrar"

    def test_health_services_maps_to_health_services(self):
        assert get_role_key_for_clearance("health_services") == "health_services"

    def test_financial_aid_maps_to_financial_aid(self):
        assert get_role_key_for_clearance("financial_aid") == "financial_aid"

    def test_business_office_maps_to_business_office(self):
        assert get_role_key_for_clearance("business_office") == "business_office"

    def test_residence_life_maps_to_residence_life(self):
        assert get_role_key_for_clearance("residence_life") == "residence_life"

    def test_public_safety_maps_to_public_safety(self):
        assert get_role_key_for_clearance("public_safety") == "public_safety"

    def test_unknown_key_returns_none(self):
        assert get_role_key_for_clearance("mystery_office") is None


# ---------------------------------------------------------------------------
# get_next_current_step
# ---------------------------------------------------------------------------

class TestGetNextCurrentStep:
    def test_registrar_ready_is_first_step(self):
        clearances = [
            make_clearance("registrar_check_in", availability="ready"),
            make_clearance("health_services", availability="locked"),
        ]
        assert get_next_current_step(clearances) == "registrar_check_in"

    def test_health_services_ready_after_registrar_approved(self):
        clearances = [
            make_clearance("registrar_check_in", status="approved", availability="completed"),
            make_clearance("health_services", availability="ready"),
            make_clearance("success_center", availability="ready"),
            make_clearance("financial_aid", availability="ready"),
            make_clearance("business_office", availability="locked"),
            make_clearance("residence_life", availability="locked"),
            make_clearance("public_safety", availability="locked"),
        ]
        # health_services is first in priority among the ready ones
        assert get_next_current_step(clearances) == "health_services"

    def test_priority_order_respected(self):
        # business_office and public_safety are ready; business_office has higher priority
        clearances = [
            make_clearance("registrar_check_in", status="approved", availability="completed"),
            make_clearance("health_services", status="approved", availability="completed"),
            make_clearance("success_center", status="approved", availability="completed"),
            make_clearance("financial_aid", status="approved", availability="completed"),
            make_clearance("business_office", availability="ready"),
            make_clearance("residence_life", availability="locked"),
            make_clearance("public_safety", availability="locked"),
        ]
        assert get_next_current_step(clearances) == "business_office"

    def test_correction_required_clearance_returned(self):
        clearances = [
            make_clearance("registrar_check_in", status="correction_required", availability="needs_student_action"),
            make_clearance("health_services", availability="locked"),
        ]
        assert get_next_current_step(clearances) == "registrar_check_in"

    def test_in_person_required_returns_public_safety(self):
        clearances = [
            make_clearance("registrar_check_in", status="approved", availability="completed"),
            make_clearance("health_services", status="approved", availability="completed"),
            make_clearance("success_center", status="approved", availability="completed"),
            make_clearance("financial_aid", status="approved", availability="completed"),
            make_clearance("business_office", status="approved", availability="completed"),
            make_clearance("residence_life", status="approved", availability="completed"),
            make_clearance("public_safety", status="in_person_required", availability="needs_student_action"),
        ]
        assert get_next_current_step(clearances) == "public_safety"

    def test_rejected_clearance_returned(self):
        clearances = [
            make_clearance("financial_aid", status="rejected", availability="completed"),
            make_clearance("business_office", availability="locked"),
        ]
        assert get_next_current_step(clearances) == "financial_aid"

    def test_all_approved_returns_fully_registered(self):
        clearances = [
            make_clearance("registrar_check_in", status="approved", availability="completed"),
            make_clearance("health_services", status="approved", availability="completed"),
            make_clearance("success_center", status="approved", availability="completed"),
            make_clearance("financial_aid", status="approved", availability="completed"),
            make_clearance("business_office", status="approved", availability="completed"),
            make_clearance("residence_life", status="approved", availability="completed"),
            make_clearance("public_safety", status="approved", availability="completed"),
        ]
        assert get_next_current_step(clearances) == "fully_registered"

    def test_ready_takes_priority_over_correction(self):
        # If there is a ready clearance, it takes priority over a correction_required one
        clearances = [
            make_clearance("registrar_check_in", status="approved", availability="completed"),
            make_clearance("health_services", status="correction_required", availability="needs_student_action"),
            make_clearance("success_center", availability="ready"),
        ]
        assert get_next_current_step(clearances) == "success_center"

    def test_empty_clearances_returns_fully_registered(self):
        # No clearances → nothing blocking → sentinel is returned
        assert get_next_current_step([]) == "fully_registered"
