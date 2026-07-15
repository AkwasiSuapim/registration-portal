"""
Workflow service — all business logic for the registration clearance workflow.

The clearance chain for all students:

  1. Registrar Check-In    → opens immediately when an application is submitted
  2. Health Services       → opens after Registrar approves          (parallel)
  2. Success Center        → opens after Registrar approves          (parallel)
  2. Financial Aid         → opens after Registrar approves          (parallel)
  3. Business Office       → opens after Financial Aid approves
  4. Residence Life        → opens after Business Office approves    (residential only)
  5. Public Safety         → opens after Residence Life approves     (residential)
                          OR opens after Business Office approves    (commuter)
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.clearance import Clearance, ClearanceDependency
from app.models.role import Role


# Ordered list of every clearance an application needs, in workflow sequence.
# This order also controls how clearances are displayed to students and officials.
CLEARANCE_TEMPLATES = [
    {
        "clearance_key": "registrar_check_in",
        "clearance_label": "Registrar Check-In Clearance",
        "role_key": "registrar",
    },
    {
        "clearance_key": "health_services",
        "clearance_label": "Health / Immunization Clearance",
        "role_key": "health_services",
    },
    {
        "clearance_key": "success_center",
        "clearance_label": "Academic / Course Registration Clearance",
        "role_key": "success_center",
    },
    {
        "clearance_key": "financial_aid",
        "clearance_label": "Financial Aid Clearance",
        "role_key": "financial_aid",
    },
    {
        "clearance_key": "business_office",
        "clearance_label": "Business Office / Payment Validation",
        "role_key": "business_office",
    },
    {
        "clearance_key": "residence_life",
        "clearance_label": "Housing / Residence Life Clearance",
        "role_key": "residence_life",
    },
    {
        "clearance_key": "public_safety",
        "clearance_label": "Public Safety / ID Clearance",
        "role_key": "public_safety",
    },
]

# Specific reason shown to the student for each locked clearance.
# Having clear, readable messages here helps students understand where they are in the process.
_INITIAL_BLOCKED_REASONS: dict[str, str] = {
    "health_services": "Waiting for Registrar Check-In approval.",
    "success_center":  "Waiting for Registrar Check-In approval.",
    "financial_aid":   "Waiting for Registrar Check-In approval.",
    "business_office": "Waiting for Financial Aid approval.",
    "residence_life":  "Waiting for Business Office approval.",
}

# Maps each office role to the single clearance it is responsible for.
# Officials cannot update any clearance except the one listed here.
# student and system_admin intentionally have no entry.
_ROLE_TO_CLEARANCE: dict[str, str] = {
    "registrar":       "registrar_check_in",
    "health_services": "health_services",
    "success_center":  "success_center",
    "financial_aid":   "financial_aid",
    "business_office": "business_office",
    "residence_life":  "residence_life",
    "public_safety":   "public_safety",
}


def get_initial_blocked_reason(clearance_key: str, housing_required: bool) -> str:
    """
    Returns the human-readable blocked reason shown when a clearance is first created.

    Public Safety has two possible reasons depending on whether the student lives on campus.
    """
    if clearance_key == "public_safety":
        if housing_required:
            return "Waiting for Residence Life approval."
        return "Waiting for Business Office approval."
    return _INITIAL_BLOCKED_REASONS.get(clearance_key, "Waiting for prerequisite clearance.")


def get_initial_clearance_state(clearance_key: str, housing_required: bool) -> dict:
    """
    Returns the initial status, availability, is_required, and blocked_reason for
    a clearance when a brand-new application is created.

    This is the single source of truth for the workflow starting state.
    Call it instead of hard-coding clearance states in multiple places.
    """
    if clearance_key == "registrar_check_in":
        return {
            "status": "pending",
            "availability": "ready",
            "is_required": True,
            "blocked_reason": None,
        }

    if clearance_key == "residence_life" and not housing_required:
        return {
            "status": "not_required",
            "availability": "completed",
            "is_required": False,
            "blocked_reason": "Residence Life is not required for commuter students.",
        }

    return {
        "status": "pending",
        "availability": "locked",
        "is_required": True,
        "blocked_reason": get_initial_blocked_reason(clearance_key, housing_required),
    }


def get_allowed_clearance_for_role(role_key: str) -> str | None:
    """
    Returns the clearance_key that a role is allowed to update.
    Returns None for roles that own no clearance (student, system_admin, unknown).
    """
    return _ROLE_TO_CLEARANCE.get(role_key)


def can_role_update_clearance(role_key: str, clearance_key: str) -> bool:
    """Returns True only if this role is the responsible office for that clearance."""
    return _ROLE_TO_CLEARANCE.get(role_key) == clearance_key


def create_default_clearances_for_application(db: Session, application) -> list[Clearance]:
    """
    Creates the seven clearance rows for a newly submitted application.

    Registrar Check-In is set to 'ready' immediately so the welcome desk
    can start processing the student right away.

    All other clearances start 'locked' and will be unlocked one by one
    as their prerequisite clearances are approved.

    For commuter students (housing_required=False), Residence Life is set
    to 'not_required' so it does not block the workflow.

    Raises RuntimeError if required roles have not been seeded yet.
    """
    roles = {role.role_key: role for role in db.query(Role).all()}
    now = datetime.now(timezone.utc)
    clearances = []

    for template in CLEARANCE_TEMPLATES:
        role = roles.get(template["role_key"])
        if role is None:
            raise RuntimeError(
                f"Role '{template['role_key']}' not found in the database. "
                "Run: python -m app.scripts.seed_data"
            )

        state = get_initial_clearance_state(
            template["clearance_key"], application.housing_required
        )
        is_registrar = template["clearance_key"] == "registrar_check_in"
        opened_at = now if is_registrar else None

        clearance = Clearance(
            application_id=application.id,
            clearance_key=template["clearance_key"],
            clearance_label=template["clearance_label"],
            office_role_id=role.id,
            status=state["status"],
            availability=state["availability"],
            is_required=state["is_required"],
            blocked_reason=state["blocked_reason"],
            opened_at=opened_at,
        )
        db.add(clearance)
        clearances.append(clearance)

    return clearances


def calculate_overall_status(clearances: list) -> str:
    """
    Derives the application's overall status from its list of clearance rows.

    Priority order (first match wins):
      rejected           — any required clearance was rejected
      correction_required — any required clearance needs a student fix
      in_person_required — Public Safety requires a physical visit and all others are approved
      fully_registered   — all required clearances are approved
      in_progress        — everything else

    Clearances with is_required=False (e.g. Residence Life for commuters)
    are excluded from blocking the overall status.
    """
    required = [c for c in clearances if c.is_required]

    if any(c.status == "rejected" for c in required):
        return "rejected"

    if any(c.status == "correction_required" for c in required):
        return "correction_required"

    # Public Safety has a special final-step status: the student visits in person for their ID.
    public_safety = next((c for c in clearances if c.clearance_key == "public_safety"), None)
    if public_safety and public_safety.status == "in_person_required":
        other_required = [c for c in required if c.clearance_key != "public_safety"]
        if all(c.status == "approved" for c in other_required):
            return "in_person_required"

    if all(c.status == "approved" for c in required):
        return "fully_registered"

    return "in_progress"


def unlock_ready_clearances(db: Session, application) -> list[Clearance]:
    """
    Scans all locked clearances for this application and unlocks any whose
    prerequisites have been approved.

    Call this after every clearance status change to advance the workflow.

    For commuter students, dependency rules marked residential_only=True are
    skipped — those rules only apply when housing_required is True.

    Returns the list of clearances that were newly set to 'ready', so the
    caller can create audit log entries if needed.
    """
    # Load all clearances for this application into a quick-lookup dict.
    all_clearances: dict[str, Clearance] = {
        c.clearance_key: c
        for c in db.query(Clearance).filter_by(application_id=application.id).all()
    }

    # Load all active workflow dependency rules.
    active_deps = db.query(ClearanceDependency).filter_by(is_active=True).all()

    # Group dependency rules by the clearance they affect.
    deps_by_target: dict[str, list[ClearanceDependency]] = {}
    for dep in active_deps:
        deps_by_target.setdefault(dep.clearance_key, []).append(dep)

    newly_unlocked: list[Clearance] = []

    for clearance_key, clearance in all_clearances.items():
        if clearance.availability != "locked":
            continue

        rules = deps_by_target.get(clearance_key, [])

        # Drop rules that only apply to residential students when this student is a commuter.
        applicable = [
            rule for rule in rules
            if not (rule.residential_only and not application.housing_required)
        ]

        # Every applicable prerequisite must be approved before we unlock.
        if not applicable:
            continue

        prerequisites_met = all(
            all_clearances.get(rule.depends_on_clearance_key) is not None
            and all_clearances[rule.depends_on_clearance_key].status == rule.unlock_on_status
            for rule in applicable
        )

        if prerequisites_met:
            clearance.availability = "ready"
            clearance.blocked_reason = None
            clearance.opened_at = datetime.now(timezone.utc)
            newly_unlocked.append(clearance)

    return newly_unlocked
