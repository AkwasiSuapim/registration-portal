"""
Tests for audit_service — Phase 8.

create_audit_log is tested directly using SessionLocal.
Rows are created with application_id=None (nullable) to avoid needing a full
application setup, keeping cleanup simple (delete-by-id).

get_application_audit_history and get_all_audit_logs are covered by
test_audit_routes.py which exercises them end-to-end via HTTP.
"""

import uuid

import pytest

from app.database import SessionLocal
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services import audit_service


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def student_user(db):
    user = db.query(User).filter_by(email="jdoe@student.livingstone.edu").first()
    assert user is not None, "Demo student not found — run seed_data first."
    return user


@pytest.fixture
def test_audit_log(db, student_user):
    """Creates one audit log row with application_id=None. Cleans up after each test."""
    log = audit_service.create_audit_log(
        db=db,
        actor_user_id=student_user.id,
        application_id=None,
        action="unit_test_action",
        details={"key": "value", "phase": 8},
    )
    db.commit()
    log_id = log.id
    yield log
    db.query(AuditLog).filter_by(id=log_id).delete()
    db.commit()


# ---------------------------------------------------------------------------
# create_audit_log
# ---------------------------------------------------------------------------

class TestCreateAuditLog:
    def test_creates_row_in_database(self, db, test_audit_log):
        persisted = db.query(AuditLog).filter_by(id=test_audit_log.id).first()
        assert persisted is not None

    def test_action_field_is_stored(self, db, test_audit_log):
        persisted = db.query(AuditLog).filter_by(id=test_audit_log.id).first()
        assert persisted.action == "unit_test_action"

    def test_details_stored_in_after_state_json(self, db, test_audit_log):
        persisted = db.query(AuditLog).filter_by(id=test_audit_log.id).first()
        assert persisted.after_state_json == {"key": "value", "phase": 8}

    def test_success_defaults_to_true(self, db, test_audit_log):
        assert test_audit_log.success is True

    def test_success_false_is_stored(self, db, student_user):
        log = audit_service.create_audit_log(
            db=db,
            actor_user_id=student_user.id,
            application_id=None,
            action="failed_action",
            success=False,
        )
        db.commit()
        try:
            persisted = db.query(AuditLog).filter_by(id=log.id).first()
            assert persisted.success is False
        finally:
            db.query(AuditLog).filter_by(id=log.id).delete()
            db.commit()

    def test_actor_role_id_stored(self, db, student_user):
        log = audit_service.create_audit_log(
            db=db,
            actor_user_id=student_user.id,
            application_id=None,
            action="role_action",
            actor_role_id=1,
        )
        db.commit()
        try:
            assert log.actor_role_id == 1
        finally:
            db.query(AuditLog).filter_by(id=log.id).delete()
            db.commit()

    def test_null_details_is_stored_as_none(self, db, student_user):
        log = audit_service.create_audit_log(
            db=db,
            actor_user_id=student_user.id,
            application_id=None,
            action="no_details_action",
        )
        db.commit()
        try:
            persisted = db.query(AuditLog).filter_by(id=log.id).first()
            assert persisted.after_state_json is None
        finally:
            db.query(AuditLog).filter_by(id=log.id).delete()
            db.commit()

    def test_occurred_at_is_set_automatically(self, db, test_audit_log):
        assert test_audit_log.occurred_at is not None

    def test_id_is_autoincremented_integer(self, db, test_audit_log):
        assert isinstance(test_audit_log.id, int)
        assert test_audit_log.id > 0

    def test_entity_type_defaults_to_application(self, db, test_audit_log):
        persisted = db.query(AuditLog).filter_by(id=test_audit_log.id).first()
        assert persisted.entity_type == "application"


# ---------------------------------------------------------------------------
# get_all_audit_logs — smoke test (full coverage in test_audit_routes.py)
# ---------------------------------------------------------------------------

class TestGetAllAuditLogs:
    def test_returns_a_list(self, db, test_audit_log):
        results = audit_service.get_all_audit_logs(db, limit=10)
        assert isinstance(results, list)

    def test_most_recent_first(self, db, test_audit_log):
        results = audit_service.get_all_audit_logs(db, limit=10)
        if len(results) >= 2:
            assert results[0].occurred_at >= results[1].occurred_at

    def test_limit_is_respected(self, db, test_audit_log):
        results = audit_service.get_all_audit_logs(db, limit=1)
        assert len(results) <= 1

    def test_new_log_appears_in_results(self, db, test_audit_log):
        results = audit_service.get_all_audit_logs(db, limit=200)
        ids = [r.id for r in results]
        assert test_audit_log.id in ids
