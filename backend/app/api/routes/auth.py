"""
Auth routes — login and current-user endpoints.

POST /auth/login   accepts identifier + password, returns JWT + user info
GET  /auth/me      reads the Bearer token, returns the current user's info
"""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.student import Student
from app.models.user import User
from app.schemas.auth import CurrentUserResponse, LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

# --- Identifier patterns ---

_STUDENT_ID_RE = re.compile(r"^100[0-9]{6}$")
_STUDENT_EMAIL_SUFFIX = "@student.livingstone.edu"
_STAFF_EMAIL_SUFFIX = "@livingstone.edu"

# --- Constant error response ---
# Always return the same message whether the identifier exists or the password
# is wrong. This prevents attackers from probing which accounts exist.
_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials. Please check your login information and try again.",
    headers={"WWW-Authenticate": "Bearer"},
)

# Computed once at startup so that "user not found" responses still run bcrypt,
# taking the same amount of time as a real password check.
_DUMMY_HASH: str = hash_password("__security_timing_guard__")


def _find_user(identifier: str, db: Session) -> User | None:
    """
    Resolves a login identifier to a User record.

    Supported identifier formats:
      - 9-digit student number (100xxxxxx)
      - Student Livingstone email   (*@student.livingstone.edu)
      - Staff Livingstone email     (*@livingstone.edu, not student subdomain)

    Returns None if the identifier format is invalid or no record matches.
    """
    identifier = identifier.strip()

    if _STUDENT_ID_RE.match(identifier):
        student = db.query(Student).filter_by(student_no=identifier).first()
        return student.user if student else None

    lower = identifier.lower()

    if lower.endswith(_STUDENT_EMAIL_SUFFIX):
        student = db.query(Student).filter_by(livingstone_email=lower).first()
        if student:
            return student.user
        return db.query(User).filter_by(email=lower).first()

    # Staff email must end with @livingstone.edu but NOT be a student address.
    if lower.endswith(_STAFF_EMAIL_SUFFIX) and not lower.endswith(_STUDENT_EMAIL_SUFFIX):
        return db.query(User).filter_by(email=lower).first()

    return None


def _build_user_response(user: User) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        account_type=user.account_type,
        role_key=user.role.role_key,
        role_name=user.role.role_name,
        is_active=user.is_active,
    )


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Log in with a student ID, student email, or staff email plus a password.

    Returns a JWT access token and basic user information on success.
    Returns 401 for any invalid combination — the message is intentionally
    vague to avoid confirming which part was wrong.
    """
    user = _find_user(request.identifier, db)

    # Always run bcrypt, even when the user is not found.
    # If we skip it for missing users, a fast response reveals that the
    # identifier does not exist. bcrypt is slow by design, so an attacker
    # could detect missing accounts by measuring response times.
    password_hash = user.password_hash if user else _DUMMY_HASH
    password_ok = verify_password(request.password, password_hash)

    if not user or not password_ok or not user.is_active:
        raise _INVALID_CREDENTIALS

    token = create_access_token(
        subject=str(user.id),
        extra_claims={
            "account_type": user.account_type,
            "role_key": user.role.role_key,
        },
    )

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=_build_user_response(user),
    )


@router.get("/me", response_model=CurrentUserResponse)
def get_me(current_user: User = Depends(deps.get_current_user)):
    """Returns the profile of the currently authenticated user."""
    return _build_user_response(current_user)
