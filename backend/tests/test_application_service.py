"""
Unit tests for application_service and workflow_service — pure logic only.

These tests do not need a database or HTTP server.
SimpleNamespace is used to create lightweight fake objects.
"""

from types import SimpleNamespace

import pytest

from app.services.application_service import calculate_total_credit_hours
from app.services.workflow_service import get_initial_clearance_state, get_initial_blocked_reason


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_course(credit_hours: int):
    return SimpleNamespace(credit_hours=credit_hours)


# ---------------------------------------------------------------------------
# calculate_total_credit_hours
# ---------------------------------------------------------------------------

class TestCalculateTotalCreditHours:
    def test_sums_correctly(self):
        courses = [make_course(4), make_course(3), make_course(3), make_course(3), make_course(4)]
        assert calculate_total_credit_hours(courses) == 17

    def test_single_course(self):
        assert calculate_total_credit_hours([make_course(3)]) == 3

    def test_exactly_fifteen(self):
        courses = [make_course(5), make_course(5), make_course(5)]
        assert calculate_total_credit_hours(courses) == 15

    def test_below_fifteen(self):
        courses = [make_course(3), make_course(3), make_course(3)]
        assert calculate_total_credit_hours(courses) == 9

    def test_empty_list_is_zero(self):
        assert calculate_total_credit_hours([]) == 0


# ---------------------------------------------------------------------------
# Clearance initial state — residential student
# ---------------------------------------------------------------------------

class TestInitialClearanceStateResidential:
    def test_registrar_starts_as_ready(self):
        state = get_initial_clearance_state("registrar_check_in", housing_required=True)
        assert state["availability"] == "ready"
        assert state["status"] == "pending"
        assert state["is_required"] is True
        assert state["blocked_reason"] is None

    def test_health_services_starts_locked(self):
        state = get_initial_clearance_state("health_services", housing_required=True)
        assert state["availability"] == "locked"
        assert state["status"] == "pending"
        assert state["is_required"] is True

    def test_success_center_starts_locked(self):
        state = get_initial_clearance_state("success_center", housing_required=True)
        assert state["availability"] == "locked"

    def test_financial_aid_starts_locked(self):
        state = get_initial_clearance_state("financial_aid", housing_required=True)
        assert state["availability"] == "locked"

    def test_business_office_starts_locked(self):
        state = get_initial_clearance_state("business_office", housing_required=True)
        assert state["availability"] == "locked"

    def test_residence_life_is_required_for_residential(self):
        state = get_initial_clearance_state("residence_life", housing_required=True)
        assert state["availability"] == "locked"
        assert state["is_required"] is True
        assert state["status"] == "pending"

    def test_public_safety_starts_locked_for_residential(self):
        state = get_initial_clearance_state("public_safety", housing_required=True)
        assert state["availability"] == "locked"
        assert state["is_required"] is True


# ---------------------------------------------------------------------------
# Clearance initial state — commuter student
# ---------------------------------------------------------------------------

class TestInitialClearanceStateCommuter:
    def test_registrar_still_starts_ready_for_commuter(self):
        state = get_initial_clearance_state("registrar_check_in", housing_required=False)
        assert state["availability"] == "ready"

    def test_residence_life_is_not_required_for_commuter(self):
        state = get_initial_clearance_state("residence_life", housing_required=False)
        assert state["status"] == "not_required"
        assert state["availability"] == "completed"
        assert state["is_required"] is False

    def test_public_safety_still_required_for_commuter(self):
        state = get_initial_clearance_state("public_safety", housing_required=False)
        assert state["availability"] == "locked"
        assert state["is_required"] is True

    def test_business_office_still_required_for_commuter(self):
        state = get_initial_clearance_state("business_office", housing_required=False)
        assert state["availability"] == "locked"
        assert state["is_required"] is True


# ---------------------------------------------------------------------------
# Blocked reasons — Public Safety path depends on residency
# ---------------------------------------------------------------------------

class TestInitialBlockedReasons:
    def test_health_services_blocked_reason(self):
        reason = get_initial_blocked_reason("health_services", housing_required=True)
        assert "Registrar" in reason

    def test_financial_aid_blocked_reason(self):
        reason = get_initial_blocked_reason("financial_aid", housing_required=True)
        assert "Registrar" in reason

    def test_business_office_blocked_reason(self):
        reason = get_initial_blocked_reason("business_office", housing_required=True)
        assert "Financial Aid" in reason

    def test_residence_life_blocked_reason(self):
        reason = get_initial_blocked_reason("residence_life", housing_required=True)
        assert "Business Office" in reason

    def test_public_safety_waits_for_residence_life_when_residential(self):
        reason = get_initial_blocked_reason("public_safety", housing_required=True)
        assert "Residence Life" in reason

    def test_public_safety_waits_for_business_office_when_commuter(self):
        reason = get_initial_blocked_reason("public_safety", housing_required=False)
        assert "Business Office" in reason
        assert "Residence Life" not in reason
