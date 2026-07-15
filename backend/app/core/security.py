"""
Security utilities — password hashing and JWT token management.

Two things live here:

  1. Password hashing
     Passwords are never stored as plain text. We run them through bcrypt,
     a deliberately slow one-way hashing algorithm. Even if the database is
     stolen, an attacker cannot recover the original passwords easily.

  2. JWT access tokens
     After a successful login, the backend issues a signed JWT (JSON Web Token).
     The frontend stores this token and sends it with every subsequent request.
     The backend verifies the signature to confirm the token is genuine — no
     database lookup required per request.

     Role checks still happen on every protected route using the database, not
     just the token claims. A stale or tampered token cannot grant new roles.
"""

from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from jose import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """Returns a bcrypt hash of the given plain-text password."""
    salt = _bcrypt.gensalt()
    hashed = _bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """
    Returns True if plain_password matches the stored hash, False otherwise.

    Uses a constant-time comparison internally to prevent timing attacks.
    Returns False (never raises) on a malformed or missing hash.
    """
    try:
        return _bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict | None = None,
) -> str:
    """
    Creates a signed JWT access token.

    subject   — the user's UUID as a string (stored in the 'sub' claim)
    extra_claims — any additional key/value pairs to embed (e.g. role_key)

    The token is signed with JWT_SECRET_KEY. Tampering with the payload
    will cause signature verification to fail on the next request.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    payload: dict = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decodes and verifies a JWT access token.

    Raises jose.JWTError if the token is invalid, expired, or tampered with.
    The caller is responsible for catching that exception.
    """
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
