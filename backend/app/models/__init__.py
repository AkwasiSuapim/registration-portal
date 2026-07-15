# Import every model here so that Base.metadata knows about all tables.
# Alembic reads Base.metadata when generating migrations — if a model is not
# imported here, its table will be missing from the generated migration file.

from app.models.role import Role
from app.models.user import User
from app.models.student import Student
from app.models.official import Official
from app.models.application import Application
from app.models.course import Course
from app.models.document import Document
from app.models.clearance import Clearance, ClearanceDependency
from app.models.notification import Notification
from app.models.audit_log import AuditLog

__all__ = [
    "Role",
    "User",
    "Student",
    "Official",
    "Application",
    "Course",
    "Document",
    "Clearance",
    "ClearanceDependency",
    "Notification",
    "AuditLog",
]
