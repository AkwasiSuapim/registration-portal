"""
Tests for the workflow service — pure functions only.

These tests use SimpleNamespace to create lightweight fake clearance
objects so they can run without a database connection.
"""

from types import SimpleNamespace

import pytest

from app.services.workflow_service import (
    CLEARANCE_TEMPLATES,
    calculate_overall_status,
    can_role_update_clearance,
    get_allowed_clearance_for_role,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_clearance(clearance_key, status, is_required=True):
    """Create a minimal clearance-like object for use in tests."""
    return SimpleNamespace(
        clearance_key=clearance_key,
        status=status,
        is_required=is_required,
    )


ALL_KEYS = [
    "registrar_check_in",
    "health_services",
    "success_center",
    "financial_aid",
    "business_office",
    "residence_life",
    "public_safety",
]


def all_approved(overrides=None):
    """Return a full set of seven clearances, all approved, with optional overrides."""
    statuses = {key: "approved" for key in ALL_KEYS}
    if overrides:
        statuses.update(overrides)
    return [make_clearance(k, v) for k, v in statuses.items()]


# ---------------------------------------------------------------------------
# CLEARANCE_TEMPLATES
# ---------------------------------------------------------------------------

class TestClearanceTemplates:
    def test_has_seven_entries(self):
        assert len(CLEARANCE_TEMPLATES) == 7

    def test_each_entry_has_required_keys(self):
        for template in CLEARANCE_TEMPLATES:
            assert "clearance_key" in template
            assert "clearance_label" in template
            assert "role_key" in template

    def test_registrar_is_first(self):
        assert CLEARANCE_TEMPLATES[0]["clearance_key"] == "registrar_check_in"

    def test_public_safety_is_last(self):
        assert CLEARANCE_TEMPLATES[-1]["clearance_key"] == "public_safety"

    def test_all_seven_keys_present(self):
        keys = [t["clearance_key"] for t in CLEARANCE_TEMPLATES]
        assert set(keys) == set(ALL_KEYS)


# ---------------------------------------------------------------------------
# get_allowed_clearance_for_role
# ---------------------------------------------------------------------------

class TestGetAllowedClearanceForRole:
    def test_registrar_maps_to_registrar_check_in(self):
        assert get_allowed_clearance_for_role("registrar") == "registrar_check_in"

    def test_financial_aid_maps_to_itself(self):
        assert get_allowed_clearance_for_role("financial_aid") == "financial_aid"

    def test_public_safety_maps_to_itself(self):
        assert get_allowed_clearance_for_role("public_safety") == "public_safety"

    def test_student_returns_none(self):
        assert get_allowed_clearance_for_role("student") is None

    def test_system_admin_returns_none(self):
        assert get_allowed_clearance_for_role("system_admin") is None

    def test_unknown_role_returns_none(self):
        assert get_allowed_clearance_for_role("does_not_exist") is None

    def test_all_seven_office_roles_have_a_mapping(self):
        office_roles = [
            "registrar", "health_services", "success_center",
            "financial_aid", "business_office", "residence_life", "public_safety",
        ]
        for role in office_roles:
            result = get_allowed_clearance_for_role(role)
            assert result is not None, f"{role} should have a clearance mapping"


# ---------------------------------------------------------------------------
# can_role_update_clearance
# ---------------------------------------------------------------------------

class TestCanRoleUpdateClearance:
    def test_matching_role_and_clearance_returns_true(self):
        assert can_role_update_clearance("financial_aid", "financial_aid") is True

    def test_registrar_owns_registrar_check_in(self):
        assert can_role_update_clearance("registrar", "registrar_check_in") is True

    def test_wrong_role_returns_false(self):
        assert can_role_update_clearance("registrar", "financial_aid") is False

    def test_student_cannot_update_any_clearance(self):
        assert can_role_update_clearance("student", "registrar_check_in") is False

    def test_admin_cannot_update_any_clearance(self):
        assert can_role_update_clearance("system_admin", "public_safety") is False


# ---------------------------------------------------------------------------
# calculate_overall_status
# ---------------------------------------------------------------------------

class TestCalculateOverallStatus:
    def test_all_approved_is_fully_registered(self):
        assert calculate_overall_status(all_approved()) == "fully_registered"

    def test_rejected_clearance_returns_rejected(self):
        clearances = all_approved({"financial_aid": "rejected"})
        assert calculate_overall_status(clearances) == "rejected"

    def test_rejected_beats_correction_required(self):
        clearances = all_approved({
            "financial_aid": "rejected",
            "health_services": "correction_required",
        })
        assert calculate_overall_status(clearances) == "rejected"

    def test_correction_required_returned_without_rejection(self):
        clearances = all_approved({"business_office": "correction_required"})
        assert calculate_overall_status(clearances) == "correction_required"

    def test_public_safety_in_person_with_others_approved_returns_in_person(self):
        clearances = all_approved({"public_safety": "in_person_required"})
        assert calculate_overall_status(clearances) == "in_person_required"

    def test_public_safety_in_person_with_other_pending_returns_in_progress(self):
        # Public Safety in-person only becomes the overall status when all others are done.
        clearances = all_approved({
            "public_safety": "in_person_required",
            "health_services": "pending",
        })
        assert calculate_overall_status(clearances) == "in_progress"

    def test_any_pending_clearance_returns_in_progress(self):
        clearances = all_approved({"business_office": "pending"})
        assert calculate_overall_status(clearances) == "in_progress"

    def test_not_required_clearance_does_not_block_registration(self):
        # Commuter student: Residence Life is not required.
        clearances = [
            make_clearance("registrar_check_in", "approved"),
            make_clearance("health_services",    "approved"),
            make_clearance("success_center",     "approved"),
            make_clearance("financial_aid",      "approved"),
            make_clearance("business_office",    "approved"),
            make_clearance("residence_life",     "not_required", is_required=False),
            make_clearance("public_safety",      "approved"),
        ]
        assert calculate_overall_status(clearances) == "fully_registered"

    def test_not_required_clearance_does_not_cause_false_rejection(self):
        # not_required status on a non-required clearance should not read as rejected.
        clearances = [
            make_clearance("registrar_check_in", "approved"),
            make_clearance("health_services",    "approved"),
            make_clearance("success_center",     "approved"),
            make_clearance("financial_aid",      "approved"),
            make_clearance("business_office",    "approved"),
            make_clearance("residence_life",     "not_required", is_required=False),
            make_clearance("public_safety",      "approved"),
        ]
        assert calculate_overall_status(clearances) != "rejected"
