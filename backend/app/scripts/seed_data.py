"""
Seed script — populates the database with essential startup data.

Run from the backend folder with the virtual environment activated:

    python -m app.scripts.seed_data

This script is idempotent: it can be run multiple times without creating
duplicate rows. Existing rows are skipped, not overwritten.
"""

import sys

from app.database import SessionLocal
from app.models.clearance import ClearanceDependency
from app.models.role import Role


# All roles used in the system.
# role_scope controls which part of the UI a user can access:
#   student  — student portal
#   official — office dashboard
#   admin    — admin dashboard
ROLES_TO_SEED = [
    {"role_key": "student",         "role_name": "Student",                   "role_scope": "student"},
    {"role_key": "registrar",       "role_name": "Welcome Desk / Registrar",  "role_scope": "official"},
    {"role_key": "health_services", "role_name": "Health Services",           "role_scope": "official"},
    {"role_key": "success_center",  "role_name": "Success Center",            "role_scope": "official"},
    {"role_key": "financial_aid",   "role_name": "Financial Aid",             "role_scope": "official"},
    {"role_key": "business_office", "role_name": "Business Office / Cashier", "role_scope": "official"},
    {"role_key": "residence_life",  "role_name": "Residence Life",            "role_scope": "official"},
    {"role_key": "public_safety",   "role_name": "Public Safety",             "role_scope": "official"},
    {"role_key": "system_admin",    "role_name": "System Admin",              "role_scope": "admin"},
]


# Workflow dependency rules.
#
# Each row means: clearance_key becomes 'ready' only after depends_on is approved.
# residential_only=True means the rule only applies to residential students.
#
# The full workflow chain:
#   1. Registrar Check-In   → starts as 'ready' immediately (no dependencies)
#   2. Health Services      → unlocks after Registrar approves
#   2. Success Center       → unlocks after Registrar approves (parallel with Health)
#   2. Financial Aid        → unlocks after Registrar approves (parallel with Health)
#   3. Business Office      → unlocks after Financial Aid approves
#   4. Residence Life       → unlocks after Business Office approves (residential only)
#   5. Public Safety (res.) → unlocks after Residence Life approves
#   5. Public Safety (com.) → unlocks after Business Office approves
DEPENDENCIES_TO_SEED = [
    # --- Step 2: Registrar must approve before these three can begin ---
    {
        "clearance_key": "health_services",
        "depends_on": "registrar_check_in",
        "residential_only": False,
    },
    {
        "clearance_key": "success_center",
        "depends_on": "registrar_check_in",
        "residential_only": False,
    },
    {
        "clearance_key": "financial_aid",
        "depends_on": "registrar_check_in",
        "residential_only": False,
    },
    # --- Step 3: Business Office waits for Financial Aid ---
    {
        "clearance_key": "business_office",
        "depends_on": "financial_aid",
        "residential_only": False,
    },
    # --- Step 4: Residence Life waits for Business Office (residential students only) ---
    {
        "clearance_key": "residence_life",
        "depends_on": "business_office",
        "residential_only": True,
    },
    # --- Step 5a: Public Safety waits for Residence Life (residential students) ---
    {
        "clearance_key": "public_safety",
        "depends_on": "residence_life",
        "residential_only": True,
    },
    # --- Step 5b: Public Safety waits for Business Office (commuter students) ---
    {
        "clearance_key": "public_safety",
        "depends_on": "business_office",
        "residential_only": False,
    },
]


def seed_roles(db) -> tuple[int, int]:
    """Creates roles that do not yet exist. Returns (created, skipped) counts."""
    created = 0
    skipped = 0
    for data in ROLES_TO_SEED:
        existing = db.query(Role).filter_by(role_key=data["role_key"]).first()
        if existing:
            skipped += 1
        else:
            db.add(Role(
                role_key=data["role_key"],
                role_name=data["role_name"],
                role_scope=data["role_scope"],
            ))
            created += 1
    return created, skipped


def seed_dependencies(db) -> tuple[int, int]:
    """Creates clearance dependency rules that do not yet exist."""
    created = 0
    skipped = 0
    for data in DEPENDENCIES_TO_SEED:
        existing = db.query(ClearanceDependency).filter_by(
            clearance_key=data["clearance_key"],
            depends_on_clearance_key=data["depends_on"],
        ).first()
        if existing:
            skipped += 1
        else:
            db.add(ClearanceDependency(
                clearance_key=data["clearance_key"],
                depends_on_clearance_key=data["depends_on"],
                residential_only=data["residential_only"],
            ))
            created += 1
    return created, skipped


def seed_all():
    db = SessionLocal()
    try:
        print("Seeding roles...")
        roles_created, roles_skipped = seed_roles(db)
        db.commit()
        print(f"  Created {roles_created} role(s), skipped {roles_skipped} existing.")

        print("Seeding clearance dependency rules...")
        deps_created, deps_skipped = seed_dependencies(db)
        db.commit()
        print(f"  Created {deps_created} dependency row(s), skipped {deps_skipped} existing.")

        print("Done.")
    except Exception as exc:
        db.rollback()
        print(f"Error during seeding: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
