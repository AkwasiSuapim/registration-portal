"""
Seed script — populates the database with essential startup data.

Run from the backend folder with the virtual environment activated:

    python -m app.scripts.seed_data

This script is idempotent: it can be run multiple times without creating
duplicate rows. Existing rows are skipped, not overwritten.

Demo users are development-only accounts. They are not created in production
(ENVIRONMENT != 'development'). Even so, never use these credentials in any
real deployment — the passwords are public knowledge.
"""

import sys

from app.core.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.clearance import ClearanceDependency
from app.models.official import Official
from app.models.role import Role
from app.models.student import Student
from app.models.user import User


# ---------------------------------------------------------------------------
# Static seed data
# ---------------------------------------------------------------------------

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

DEPENDENCIES_TO_SEED = [
    # Step 2: Registrar must approve before Health, Success Center, and Financial Aid can begin.
    {"clearance_key": "health_services",  "depends_on": "registrar_check_in", "residential_only": False},
    {"clearance_key": "success_center",   "depends_on": "registrar_check_in", "residential_only": False},
    {"clearance_key": "financial_aid",    "depends_on": "registrar_check_in", "residential_only": False},
    # Step 3: Business Office waits for Financial Aid.
    {"clearance_key": "business_office",  "depends_on": "financial_aid",      "residential_only": False},
    # Step 4: Residence Life waits for Business Office (residential students only).
    {"clearance_key": "residence_life",   "depends_on": "business_office",    "residential_only": True},
    # Step 5a: Public Safety waits for Residence Life (residential students).
    {"clearance_key": "public_safety",    "depends_on": "residence_life",     "residential_only": True},
    # Step 5b: Public Safety waits for Business Office (commuter students).
    {"clearance_key": "public_safety",    "depends_on": "business_office",    "residential_only": False},
]

# Password shared by all demo accounts.
_DEMO_PASSWORD = "Password123!"

# Demo student accounts.
_DEMO_STUDENTS = [
    {
        "email": "jdoe@student.livingstone.edu",
        "account_type": "student",
        "role_key": "student",
        "student_no": "100123456",
        "livingstone_email": "jdoe@student.livingstone.edu",
        "first_name": "John",
        "last_name": "Doe",
        "residency_type": "residential",
    },
    {
        "email": "asmith@student.livingstone.edu",
        "account_type": "student",
        "role_key": "student",
        "student_no": "100222222",
        "livingstone_email": "asmith@student.livingstone.edu",
        "first_name": "Alice",
        "last_name": "Smith",
        "major": "Mathematics",
        "residency_type": "residential",
    },
    {
        "email": "mjohnson@student.livingstone.edu",
        "account_type": "student",
        "role_key": "student",
        "student_no": "100333333",
        "livingstone_email": "mjohnson@student.livingstone.edu",
        "first_name": "Michael",
        "last_name": "Johnson",
        "major": "Computer Information Systems",
        "residency_type": "residential",
    },
    {
        "email": "akyerematen@student.livingstone.edu",
        "account_type": "student",
        "role_key": "student",
        "student_no": "100444444",
        "livingstone_email": "akyerematen@student.livingstone.edu",
        "first_name": "Kwame",
        "last_name": "Akyerematen",
        "major": "Data Science",
        "residency_type": "residential",
    },
]

# Demo official accounts — one per office role.
_DEMO_OFFICIALS = [
    {"email": "registrar@livingstone.edu",     "role_key": "registrar",       "first_name": "Registrar",  "last_name": "Staff"},
    {"email": "health@livingstone.edu",         "role_key": "health_services", "first_name": "Health",     "last_name": "Staff"},
    {"email": "success@livingstone.edu",        "role_key": "success_center",  "first_name": "Success",    "last_name": "Staff"},
    {"email": "financialaid@livingstone.edu",   "role_key": "financial_aid",   "first_name": "Financial",  "last_name": "Aid"},
    {"email": "businessoffice@livingstone.edu", "role_key": "business_office", "first_name": "Business",   "last_name": "Office"},
    {"email": "residencelife@livingstone.edu",  "role_key": "residence_life",  "first_name": "Residence",  "last_name": "Life"},
    {"email": "publicsafety@livingstone.edu",   "role_key": "public_safety",   "first_name": "Public",     "last_name": "Safety"},
]

# Demo admin account.
_DEMO_ADMIN = {
    "email": "admin@livingstone.edu",
    "account_type": "admin",
    "role_key": "system_admin",
    "first_name": "System",
    "last_name": "Admin",
}


# ---------------------------------------------------------------------------
# Seed functions
# ---------------------------------------------------------------------------

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


def seed_demo_students(db, roles: dict[str, Role]) -> tuple[int, int]:
    """
    Creates demo student users and profiles if they do not exist.

    Returns (created, skipped) counts.
    """
    created = 0
    skipped = 0
    for data in _DEMO_STUDENTS:
        existing = db.query(User).filter_by(email=data["email"]).first()
        if existing:
            skipped += 1
            continue

        role = roles[data["role_key"]]
        user = User(
            email=data["email"],
            password_hash=hash_password(_DEMO_PASSWORD),
            account_type=data["account_type"],
            role_id=role.id,
        )
        db.add(user)
        db.flush()  # populate user.id before creating the student profile

        student = Student(
            user_id=user.id,
            student_no=data["student_no"],
            livingstone_email=data["livingstone_email"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            major=data.get("major"),
            residency_type=data["residency_type"],
        )
        db.add(student)
        created += 1

    return created, skipped


def seed_demo_officials(db, roles: dict[str, Role]) -> tuple[int, int]:
    """
    Creates one demo official user + profile for each office role.

    Returns (created, skipped) counts.
    """
    created = 0
    skipped = 0
    for data in _DEMO_OFFICIALS:
        existing = db.query(User).filter_by(email=data["email"]).first()
        if existing:
            skipped += 1
            continue

        role = roles[data["role_key"]]
        user = User(
            email=data["email"],
            password_hash=hash_password(_DEMO_PASSWORD),
            account_type="official",
            role_id=role.id,
        )
        db.add(user)
        db.flush()

        official = Official(
            user_id=user.id,
            staff_email=data["email"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )
        db.add(official)
        created += 1

    return created, skipped


def seed_demo_admin(db, roles: dict[str, Role]) -> str:
    """
    Creates the demo system admin user if it does not exist.

    Returns 'created' or 'skipped'.
    """
    data = _DEMO_ADMIN
    existing = db.query(User).filter_by(email=data["email"]).first()
    if existing:
        return "skipped"

    role = roles[data["role_key"]]
    user = User(
        email=data["email"],
        password_hash=hash_password(_DEMO_PASSWORD),
        account_type=data["account_type"],
        role_id=role.id,
    )
    db.add(user)
    return "created"


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

        # Load roles into a dict for the demo user functions.
        roles = {r.role_key: r for r in db.query(Role).all()}

        if settings.ENVIRONMENT == "development":
            print("Seeding demo users (development only)...")

            student_created, student_skipped = seed_demo_students(db, roles)
            print(
                f"  Demo students: created {student_created}, "
                f"skipped {student_skipped} existing."
            )

            off_created, off_skipped = seed_demo_officials(db, roles)
            print(f"  Demo officials: created {off_created}, skipped {off_skipped} existing.")

            admin_result = seed_demo_admin(db, roles)
            print(f"  Demo admin (admin@livingstone.edu): {admin_result}.")

            db.commit()
        else:
            print(f"Skipping demo users (ENVIRONMENT={settings.ENVIRONMENT!r}).")

        print("Done.")
    except Exception as exc:
        db.rollback()
        print(f"Error during seeding: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
