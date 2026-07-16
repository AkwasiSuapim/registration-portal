"""
Unit and integration tests for notification_service — Phase 8.

Tests that need a real DB session (get_notifications_for_user, mark-as-read, etc.)
use SessionLocal directly with seeded demo users.

Tests that exercise pure logic (user_can_access_notification) use SimpleNamespace
to avoid any DB overhead.
"""

import uuid
from types import SimpleNamespace

import pytest

from app.database import SessionLocal
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.services import notification_service


# ---------------------------------------------------------------------------
# Shared DB fixtures
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
def registrar_user(db):
    user = db.query(User).filter_by(email="registrar@livingstone.edu").first()
    assert user is not None, "Registrar user not found — run seed_data first."
    return user


@pytest.fixture
def student_notification(db, student_user):
    """Creates a direct user notification for the demo student. Cleans up after each test."""
    notif = Notification(
        recipient_user_id=student_user.id,
        event_type="test_event",
        title="Test Notification",
        body="This is a service-level test notification.",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    yield notif
    db.query(Notification).filter_by(id=notif.id).delete()
    db.commit()


@pytest.fixture
def registrar_role_notification(db):
    """Creates a role notification for the registrar role. Cleans up after each test."""
    role = db.query(Role).filter_by(role_key="registrar").first()
    assert role is not None, "Registrar role not found — run seed_data first."
    notif = Notification(
        recipient_role_id=role.id,
        event_type="test_role_event",
        title="Test Role Notification",
        body="This is a service-level test role notification.",
        dedupe_key=f"test:svc:role:{uuid.uuid4().hex}",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    yield notif
    db.query(Notification).filter_by(id=notif.id).delete()
    db.commit()


# ---------------------------------------------------------------------------
# user_can_access_notification — pure logic, no DB
# ---------------------------------------------------------------------------

class TestUserCanAccessNotification:
    def test_student_can_access_own_notification(self):
        uid = uuid.uuid4()
        user = SimpleNamespace(account_type="student", id=uid, role_id=1)
        notif = SimpleNamespace(recipient_user_id=uid, recipient_role_id=None)
        assert notification_service.user_can_access_notification(user, notif)

    def test_student_cannot_access_role_notification(self):
        user = SimpleNamespace(account_type="student", id=uuid.uuid4(), role_id=1)
        notif = SimpleNamespace(recipient_user_id=None, recipient_role_id=1)
        assert not notification_service.user_can_access_notification(user, notif)

    def test_student_cannot_access_other_students_notification(self):
        user = SimpleNamespace(account_type="student", id=uuid.uuid4(), role_id=1)
        notif = SimpleNamespace(recipient_user_id=uuid.uuid4(), recipient_role_id=None)
        assert not notification_service.user_can_access_notification(user, notif)

    def test_official_can_access_own_role_notification(self):
        user = SimpleNamespace(account_type="official", id=uuid.uuid4(), role_id=2)
        notif = SimpleNamespace(recipient_user_id=None, recipient_role_id=2)
        assert notification_service.user_can_access_notification(user, notif)

    def test_official_cannot_access_different_role_notification(self):
        user = SimpleNamespace(account_type="official", id=uuid.uuid4(), role_id=2)
        notif = SimpleNamespace(recipient_user_id=None, recipient_role_id=3)
        assert not notification_service.user_can_access_notification(user, notif)

    def test_official_can_access_direct_user_notification(self):
        uid = uuid.uuid4()
        user = SimpleNamespace(account_type="official", id=uid, role_id=2)
        notif = SimpleNamespace(recipient_user_id=uid, recipient_role_id=None)
        assert notification_service.user_can_access_notification(user, notif)


# ---------------------------------------------------------------------------
# get_notifications_for_user
# ---------------------------------------------------------------------------

class TestGetNotificationsForUser:
    def test_student_sees_own_direct_notification(self, db, student_user, student_notification):
        results = notification_service.get_notifications_for_user(db, student_user)
        ids = [n.id for n in results]
        assert student_notification.id in ids

    def test_student_does_not_see_role_notification(self, db, student_user, registrar_role_notification):
        results = notification_service.get_notifications_for_user(db, student_user)
        ids = [n.id for n in results]
        assert registrar_role_notification.id not in ids

    def test_registrar_sees_role_notification(self, db, registrar_user, registrar_role_notification):
        results = notification_service.get_notifications_for_user(db, registrar_user)
        ids = [n.id for n in results]
        assert registrar_role_notification.id in ids

    def test_unread_only_excludes_already_read(self, db, student_user, student_notification):
        student_notification.is_read = True
        db.commit()
        results = notification_service.get_notifications_for_user(db, student_user, unread_only=True)
        ids = [n.id for n in results]
        assert student_notification.id not in ids
        # Restore
        student_notification.is_read = False
        db.commit()

    def test_unread_only_includes_unread(self, db, student_user, student_notification):
        results = notification_service.get_notifications_for_user(db, student_user, unread_only=True)
        ids = [n.id for n in results]
        assert student_notification.id in ids

    def test_limit_is_respected(self, db, student_user, student_notification):
        results = notification_service.get_notifications_for_user(db, student_user, limit=1)
        assert len(results) <= 1

    def test_results_ordered_newest_first(self, db, student_user, student_notification):
        results = notification_service.get_notifications_for_user(db, student_user)
        if len(results) >= 2:
            assert results[0].created_at >= results[1].created_at


# ---------------------------------------------------------------------------
# get_unread_notification_count
# ---------------------------------------------------------------------------

class TestGetUnreadNotificationCount:
    def test_count_includes_new_notification(self, db, student_user, student_notification):
        counts = notification_service.get_unread_notification_count(db, student_user)
        assert counts["unread_count"] >= 1
        assert counts["total_count"] >= 1

    def test_unread_count_decreases_after_mark_read(self, db, student_user, student_notification):
        before = notification_service.get_unread_notification_count(db, student_user)
        notification_service.mark_notification_as_read(db, student_user, student_notification.id)
        after = notification_service.get_unread_notification_count(db, student_user)
        assert after["unread_count"] == before["unread_count"] - 1
        assert after["total_count"] == before["total_count"]

    def test_total_count_is_at_least_unread_count(self, db, student_user, student_notification):
        counts = notification_service.get_unread_notification_count(db, student_user)
        assert counts["total_count"] >= counts["unread_count"]


# ---------------------------------------------------------------------------
# mark_notification_as_read
# ---------------------------------------------------------------------------

class TestMarkNotificationAsRead:
    def test_mark_sets_is_read_true(self, db, student_user, student_notification):
        assert not student_notification.is_read
        notification_service.mark_notification_as_read(db, student_user, student_notification.id)
        db.refresh(student_notification)
        assert student_notification.is_read

    def test_mark_sets_delivery_status_to_read(self, db, student_user, student_notification):
        notification_service.mark_notification_as_read(db, student_user, student_notification.id)
        db.refresh(student_notification)
        assert student_notification.delivery_status == "read"

    def test_mark_sets_read_at_timestamp(self, db, student_user, student_notification):
        notification_service.mark_notification_as_read(db, student_user, student_notification.id)
        db.refresh(student_notification)
        assert student_notification.read_at is not None

    def test_mark_is_idempotent(self, db, student_user, student_notification):
        notification_service.mark_notification_as_read(db, student_user, student_notification.id)
        # Calling again must not raise
        result = notification_service.mark_notification_as_read(db, student_user, student_notification.id)
        assert result.is_read

    def test_mark_nonexistent_raises_404(self, db, student_user):
        from fastapi import HTTPException
        fake_id = uuid.uuid4()
        with pytest.raises(HTTPException) as exc_info:
            notification_service.mark_notification_as_read(db, student_user, fake_id)
        assert exc_info.value.status_code == 404

    def test_student_cannot_mark_role_notification(self, db, student_user, registrar_role_notification):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            notification_service.mark_notification_as_read(
                db, student_user, registrar_role_notification.id,
            )
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# mark_all_notifications_as_read
# ---------------------------------------------------------------------------

class TestMarkAllNotificationsAsRead:
    def test_marks_own_unread_notifications(self, db, student_user, student_notification):
        student_notification.is_read = False
        db.commit()
        count = notification_service.mark_all_notifications_as_read(db, student_user)
        assert count >= 1
        db.refresh(student_notification)
        assert student_notification.is_read

    def test_returns_zero_when_nothing_unread(self, db, student_user, student_notification):
        # Pre-mark as read
        notification_service.mark_notification_as_read(db, student_user, student_notification.id)
        count = notification_service.mark_all_notifications_as_read(db, student_user)
        assert count == 0

    def test_does_not_mark_other_users_notifications(self, db, student_user, registrar_role_notification):
        # The student calling mark-all should NOT affect the registrar role notification
        registrar_role_notification.is_read = False
        db.commit()
        notification_service.mark_all_notifications_as_read(db, student_user)
        db.refresh(registrar_role_notification)
        assert not registrar_role_notification.is_read
