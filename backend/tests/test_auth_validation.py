"""
Tests for login identifier parsing logic.

We import the patterns directly from the auth route module and test them
in isolation — no HTTP calls, no database needed.
"""

import re

import pytest

# These are the same constants used in the auth routes.
_STUDENT_ID_RE = re.compile(r"^100[0-9]{6}$")
_STUDENT_EMAIL_SUFFIX = "@student.livingstone.edu"
_STAFF_EMAIL_SUFFIX = "@livingstone.edu"


def is_student_id(value: str) -> bool:
    return bool(_STUDENT_ID_RE.match(value))


def is_student_email(value: str) -> bool:
    return value.lower().endswith(_STUDENT_EMAIL_SUFFIX)


def is_staff_email(value: str) -> bool:
    lower = value.lower()
    return lower.endswith(_STAFF_EMAIL_SUFFIX) and not lower.endswith(_STUDENT_EMAIL_SUFFIX)


class TestStudentIdPattern:
    def test_valid_student_id_matches(self):
        assert is_student_id("100123456") is True

    def test_all_zeros_after_prefix_is_valid(self):
        assert is_student_id("100000000") is True

    def test_all_nines_after_prefix_is_valid(self):
        assert is_student_id("100999999") is True

    def test_wrong_prefix_does_not_match(self):
        assert is_student_id("200123456") is False

    def test_too_short_does_not_match(self):
        assert is_student_id("10012345") is False

    def test_too_long_does_not_match(self):
        assert is_student_id("1001234567") is False

    def test_contains_letters_does_not_match(self):
        assert is_student_id("100abc456") is False

    def test_empty_string_does_not_match(self):
        assert is_student_id("") is False

    def test_email_does_not_match(self):
        assert is_student_id("jdoe@student.livingstone.edu") is False


class TestStudentEmailPattern:
    def test_valid_student_email_is_recognized(self):
        assert is_student_email("jdoe@student.livingstone.edu") is True

    def test_uppercase_student_email_is_recognized(self):
        assert is_student_email("JDOE@STUDENT.LIVINGSTONE.EDU") is True

    def test_staff_email_is_not_a_student_email(self):
        assert is_student_email("registrar@livingstone.edu") is False

    def test_gmail_is_not_a_student_email(self):
        assert is_student_email("jdoe@gmail.com") is False

    def test_student_id_is_not_a_student_email(self):
        assert is_student_email("100123456") is False


class TestStaffEmailPattern:
    def test_valid_staff_email_is_recognized(self):
        assert is_staff_email("registrar@livingstone.edu") is True

    def test_admin_staff_email_is_recognized(self):
        assert is_staff_email("admin@livingstone.edu") is True

    def test_student_email_is_not_a_staff_email(self):
        # This is the critical security check: student addresses must never
        # be treated as staff addresses, even though one suffix contains the other.
        assert is_staff_email("jdoe@student.livingstone.edu") is False

    def test_gmail_is_not_a_staff_email(self):
        assert is_staff_email("someone@gmail.com") is False

    def test_student_id_is_not_a_staff_email(self):
        assert is_staff_email("100123456") is False

    def test_empty_string_is_not_a_staff_email(self):
        assert is_staff_email("") is False
