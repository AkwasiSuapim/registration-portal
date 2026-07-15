"""
Shared FastAPI dependencies — authentication and authorization.

Import these in route files to protect endpoints:

    from app.api import deps

    @router.get("/protected")
    def protected_route(user: User = Depends(deps.get_current_user)):
        ...

Each dependency builds on the previous one:
  get_current_user   — reads and verifies the Bearer token, returns the User
  require_student    — same as above + enforces account_type == 'student'
  require_official   — same as above + enforces account_type == 'official'
  require_admin      — same as above + enforces role_key == 'system_admin'
  require_role(key)  — same as above + enforces a specific office role
"""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.official import Official
from app.models.student import Student
from app.models.user import User

# FastAPI reads the Bearer token from the Authorization header.
# tokenUrl is only used by the interactive Swagger UI docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_NOT_AUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication required. Please log in.",
    headers={"WWW-Authenticate": "Bearer"},
)

_NOT_AUTHORIZED = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="You do not have permission to access this resource.",
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Reads the Bearer token from the Authorization header, decodes it,
    and loads the matching User from the database.

    Raises 401 if the token is missing, expired, tampered with, or the
    account has been deactivated since the token was issued.
    """
    try:
        payload = decode_access_token(token)
        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            raise _NOT_AUTHENTICATED
    except JWTError:
        raise _NOT_AUTHENTICATED

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise _NOT_AUTHENTICATED

    user = db.query(User).filter_by(id=user_uuid).first()
    if user is None or not user.is_active:
        raise _NOT_AUTHENTICATED

    return user


def require_student(current_user: User = Depends(get_current_user)) -> User:
    """Allows only users with account_type == 'student'. Raises 403 otherwise."""
    if current_user.account_type != "student":
        raise _NOT_AUTHORIZED
    return current_user


def require_official(current_user: User = Depends(get_current_user)) -> User:
    """Allows only users with account_type == 'official'. Raises 403 otherwise."""
    if current_user.account_type != "official":
        raise _NOT_AUTHORIZED
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allows only system admin accounts. Raises 403 otherwise."""
    if current_user.role.role_key != "system_admin":
        raise _NOT_AUTHORIZED
    return current_user


def require_role(role_key: str):
    """
    Returns a dependency that allows only users with the given role_key.

    Usage:
        @router.get("/registrar-only")
        def registrar_route(user: User = Depends(deps.require_role("registrar"))):
            ...
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.role_key != role_key:
            raise _NOT_AUTHORIZED
        return current_user
    return _check


def get_current_student(
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db),
) -> Student:
    """
    Returns the Student profile for the currently logged-in student.

    Combines authentication, student-role check, and profile lookup in one step.
    """
    student = db.query(Student).filter_by(user_id=current_user.id).first()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found.",
        )
    return student


def get_current_official(
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db),
) -> Official:
    """
    Returns the Official profile for the currently logged-in office staff member.

    Combines authentication, official-role check, and profile lookup in one step.
    """
    official = db.query(Official).filter_by(user_id=current_user.id).first()
    if official is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Official profile not found.",
        )
    return official
