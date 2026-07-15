"""
Tests for app/core/security.py — password hashing and JWT utilities.

These tests are pure unit tests: they do not need a database or server.
"""

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestHashPassword:
    def test_hash_is_different_from_plain_password(self):
        plain = "MySecretPassword!"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_hash_is_a_string(self):
        assert isinstance(hash_password("test123"), str)

    def test_same_password_produces_different_hashes(self):
        # bcrypt salts each hash independently, so two calls never match.
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2


class TestVerifyPassword:
    def test_correct_password_returns_true(self):
        plain = "CorrectHorseBatteryStaple"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_wrong_password_returns_false(self):
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_empty_password_does_not_match_non_empty_hash(self):
        hashed = hash_password("not_empty")
        assert verify_password("", hashed) is False


class TestCreateAccessToken:
    def test_returns_a_string(self):
        token = create_access_token(subject="some-user-id")
        assert isinstance(token, str)

    def test_token_is_not_empty(self):
        token = create_access_token(subject="some-user-id")
        assert len(token) > 0

    def test_different_subjects_produce_different_tokens(self):
        t1 = create_access_token(subject="user-1")
        t2 = create_access_token(subject="user-2")
        assert t1 != t2


class TestDecodeAccessToken:
    def test_decoded_subject_matches_original(self):
        subject = "abc-123-def-456"
        token = create_access_token(subject=subject)
        payload = decode_access_token(token)
        assert payload["sub"] == subject

    def test_extra_claims_are_present_after_decode(self):
        token = create_access_token(
            subject="user-id",
            extra_claims={"role_key": "registrar", "account_type": "official"},
        )
        payload = decode_access_token(token)
        assert payload["role_key"] == "registrar"
        assert payload["account_type"] == "official"

    def test_invalid_token_raises_error(self):
        import pytest
        from jose import JWTError

        with pytest.raises(JWTError):
            decode_access_token("this.is.not.a.valid.jwt")
