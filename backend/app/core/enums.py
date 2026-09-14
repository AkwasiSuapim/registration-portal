"""
Canonical enums shared across schemas and services.

OfficeKey is the single source of truth for the seven office values an
official can be assigned to. The database still stores the lowercase
role_key (registrar, health_services, ...) on roles/users — that part of
the schema is unchanged — but every admin-facing API request/response
uses these canonical, uppercase values so the frontend and backend never
drift on spelling. OfficeKey.value.lower() always equals the matching
Role.role_key; this file is the only place that mapping needs to hold.
"""

from enum import Enum

from fastapi import HTTPException, status


class OfficeKey(str, Enum):
    REGISTRAR = "REGISTRAR"
    HEALTH_SERVICES = "HEALTH_SERVICES"
    SUCCESS_CENTER = "SUCCESS_CENTER"
    FINANCIAL_AID = "FINANCIAL_AID"
    BUSINESS_OFFICE = "BUSINESS_OFFICE"
    RESIDENCE_LIFE = "RESIDENCE_LIFE"
    PUBLIC_SAFETY = "PUBLIC_SAFETY"

    @property
    def role_key(self) -> str:
        """The lowercase roles.role_key value this office maps to."""
        return self.value.lower()

    @classmethod
    def from_role_key(cls, role_key: str) -> "OfficeKey | None":
        try:
            return cls(role_key.upper())
        except ValueError:
            return None


def require_office_role(db, office: OfficeKey):
    """
    Looks up the Role row for a canonical OfficeKey. Raises 500 if the
    role is somehow missing from the database (seed data not run) —
    this should never happen once app.scripts.seed_data has been run.
    """
    from app.models.role import Role

    role = db.query(Role).filter_by(role_key=office.role_key, role_scope="official").first()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Office role '{office.value}' is not seeded. Run: python -m app.scripts.seed_data",
        )
    return role
