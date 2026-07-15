# Student Registration Portal — Backend

FastAPI backend for the Livingstone College Student Registration Portal.

---

## Requirements

- Python 3.11 or later
- PostgreSQL 15 or later (needed from Phase 2 onward)

---

## Setup

### 1. Create and activate a virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Create your environment file

```bash
cp .env.example .env
```

Open `.env` and set your values. At minimum, update:
- `DATABASE_URL` — your local PostgreSQL connection string
- `JWT_SECRET_KEY` — any long random string (do not use the default in production)

### 4. Run the API server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

Interactive API docs: `http://localhost:8000/docs`

### 5. Health check

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"Student Registration Portal API"}

curl http://localhost:8000/api/health
# {"status":"ok","service":"Student Registration Portal API"}
```

---

## Database setup (Phase 2 onward)

PostgreSQL must be running before you apply migrations.

**Create the database:**

```bash
psql -U postgres -c "CREATE DATABASE student_registration_portal;"
```

**Run migrations:**

```bash
alembic upgrade head
```

**Seed roles and workflow dependencies:**

```bash
python -m app.scripts.seed_data
```

---

## Demo login accounts (development only)

These accounts are created by the seed script. **Do not use these credentials in any production environment.**

### Demo student

```
identifier: 100123456
         or jdoe@student.livingstone.edu
password:  Password123!
```

### Demo officials

All demo officials use password `Password123!`.

| Email | Office |
|---|---|
| `registrar@livingstone.edu` | Welcome Desk / Registrar |
| `health@livingstone.edu` | Health Services |
| `success@livingstone.edu` | Success Center |
| `financialaid@livingstone.edu` | Financial Aid |
| `businessoffice@livingstone.edu` | Business Office / Cashier |
| `residencelife@livingstone.edu` | Residence Life |
| `publicsafety@livingstone.edu` | Public Safety |

### Demo admin

```
identifier: admin@livingstone.edu
password:  Password123!
```

---

## Clearance workflow API (Phase 6)

All clearance endpoints require a `Bearer` token from `POST /auth/login`.

**Official queue — see all clearances assigned to your office:**

```bash
curl http://localhost:8000/officials/me/queue \
  -H "Authorization: Bearer OFFICIAL_TOKEN"

# Filter to only applications ready for your review:
curl "http://localhost:8000/officials/me/queue?availability=ready" \
  -H "Authorization: Bearer OFFICIAL_TOKEN"
```

**Review a full application (officials and admins only):**

```bash
curl http://localhost:8000/applications/{application_id}/review \
  -H "Authorization: Bearer OFFICIAL_TOKEN"
```

**Approve a clearance:**

```bash
curl -X PATCH http://localhost:8000/clearances/{clearance_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer OFFICIAL_TOKEN" \
  -d '{"action": "approve"}'
```

**Request a correction (message required):**

```bash
curl -X PATCH http://localhost:8000/clearances/{clearance_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer OFFICIAL_TOKEN" \
  -d '{"action": "request_correction", "message": "Please provide updated immunization records."}'
```

**Reject a clearance (message required):**

```bash
curl -X PATCH http://localhost:8000/clearances/{clearance_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer OFFICIAL_TOKEN" \
  -d '{"action": "reject", "message": "Outstanding balance must be settled first."}'
```

**Mark in-person visit required (Public Safety only):**

```bash
curl -X PATCH http://localhost:8000/clearances/{clearance_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PUBLIC_SAFETY_TOKEN" \
  -d '{"action": "mark_in_person_required"}'
```

Business rules enforced by the backend:
- Only the office responsible for a clearance can update it (returns 403 otherwise).
- A clearance must be `ready` or `needs_student_action` before it can be updated (returns 409 if locked or already finalized).
- `request_correction` and `reject` require a non-empty `message` field (returns 422 if omitted).
- Only Public Safety can use `mark_in_person_required` (returns 403 for other offices).
- Approving a clearance automatically unlocks all downstream clearances whose prerequisites are now met.
- After every clearance update the application's `overall_status` and `current_step` are recalculated.
- Student and office notifications are created automatically on every clearance update.

Residential workflow dependency order:
```
registrar_check_in → health_services  (parallel)
                   → success_center   (parallel)
                   → financial_aid    (parallel)
financial_aid      → business_office
business_office    → residence_life   (residential students only)
residence_life     → public_safety    (residential)
business_office    → public_safety    (commuter — skips residence_life)
```

---

## Application API (Phase 5)

All application endpoints require a `Bearer` token from `POST /auth/login`.

**Submit a new registration application:**

```bash
curl -X POST http://localhost:8000/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "term_code": "Fall 2026",
    "academic_year": "2026-2027",
    "major": "Mathematics",
    "classification": "Freshman",
    "housing_required": true,
    "courses": [
      {"course_code": "MAT 231", "course_title": "Calculus I",               "section": "01", "credit_hours": 4},
      {"course_code": "CIS 201", "course_title": "Introduction to Programming","section": "01", "credit_hours": 3},
      {"course_code": "ENG 131", "course_title": "College Writing",           "section": "02", "credit_hours": 3},
      {"course_code": "HIS 232", "course_title": "African American History II","section": "01", "credit_hours": 3},
      {"course_code": "BIO 101", "course_title": "General Biology",           "section": "01", "credit_hours": 4}
    ]
  }'
```

**Get all applications for the current student:**

```bash
curl http://localhost:8000/students/me/applications \
  -H "Authorization: Bearer TOKEN"
```

**Get one application by ID:**

```bash
curl http://localhost:8000/applications/{application_id} \
  -H "Authorization: Bearer TOKEN"
```

**Get clearance workflow status:**

```bash
curl http://localhost:8000/applications/{application_id}/status \
  -H "Authorization: Bearer TOKEN"
```

Business rules enforced by the backend:
- Minimum 15 credit hours required (returns 422 with a clear message if not met)
- One application per student per term (returns 409 on duplicate)
- Students can only see their own applications (returns 404 for any other application)
- 7 clearances created automatically on submission
- Registrar Check-In starts as `ready`; all others start `locked` (or `not_required` for Residence Life on commuter students)

---

## Auth API examples

**Login as a student (student ID):**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "100123456", "password": "Password123!"}'
```

**Login as a student (email):**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "jdoe@student.livingstone.edu", "password": "Password123!"}'
```

**Login as an official:**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "registrar@livingstone.edu", "password": "Password123!"}'
```

**Get the current user (replace TOKEN with the access_token from login):**

```bash
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer TOKEN"
```

---

## Quality checks

Run these before completing any backend phase.

**Check for syntax and import errors:**

```bash
python -m compileall app
```

**Run the test suite:**

```bash
pytest -q
```

**Run both together (recommended before every phase handoff):**

```bash
python -m compileall app && pytest -q
```

**If database models or migrations changed, also run:**

```bash
alembic upgrade head
```

**Run tests with coverage report:**

```bash
pytest --cov=app --cov-report=term-missing -q
```

---

## Project structure

```
backend/
  app/
    main.py               # FastAPI app entry point
    database.py           # SQLAlchemy engine and session (Phase 2)
    core/
      config.py           # Settings loaded from .env
      security.py         # Password hashing and JWT (Phase 4) ✓
    models/               # SQLAlchemy ORM models (Phase 2)
    schemas/              # Pydantic request/response schemas (Phase 2+)
    api/
      deps.py             # Shared FastAPI dependencies (Phase 4)
      deps.py             # Shared FastAPI dependencies (Phase 4) ✓
      routes/
        health.py         # Health check endpoints
        auth.py           # Login and current user (Phase 4) ✓
        students.py       # Student profile endpoints (Phase 5)
        applications.py   # Application submission (Phase 5)
        officials.py      # Official queue (Phase 6)
        clearances.py     # Clearance update workflow (Phase 6)
        documents.py      # File upload and download (Phase 7)
        notifications.py  # In-app notifications (Phase 8)
    services/
      workflow_service.py # Clearance dependency logic (Phase 3)
      audit_service.py    # Audit log helpers (Phase 8)
      notification_service.py
      document_service.py
    scripts/
      seed_data.py        # Seed roles and demo users (Phase 3)
  alembic/                # Database migration files (Phase 2)
  alembic.ini
  requirements.txt
  .env.example
  README.md
```

---

## Document upload API (Phase 7)

Files are stored locally under `backend/uploads/documents/` and served only through authorized API routes. Raw file paths are never exposed in API responses.

**Upload a document for an application (student only):**

```bash
curl -X POST "http://localhost:8000/applications/{application_id}/documents" \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -F "document_type=immunization_record" \
  -F "file=@/path/to/immunization.pdf"
```

**List documents for an application:**

```bash
curl "http://localhost:8000/applications/{application_id}/documents" \
  -H "Authorization: Bearer TOKEN"
```

**Download a document by ID:**

```bash
curl "http://localhost:8000/documents/{document_id}/download" \
  -H "Authorization: Bearer TOKEN" \
  --output downloaded_file.pdf
```

**Allowed file types:**
- PDF (`application/pdf`, `.pdf`)
- PNG (`image/png`, `.png`)
- JPEG (`image/jpeg`, `.jpg`, `.jpeg`)
- DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `.docx`)

**Max file size:** 10 MB per file

**Allowed document types:** `photo_id`, `immunization_record`, `financial_aid_form`, `scholarship_agreement`, `housing_form`, `transcript`, `course_schedule`, `other`

Business rules enforced by the backend:
- Only authenticated students can upload documents to their own application.
- Officials and admins can list and download documents for review, but cannot upload.
- Unauthenticated access is rejected (401).
- Unsupported file types return 415.
- Files over 10 MB return 413.
- Raw server file paths are never returned in API responses.
- Re-uploading the same document type creates a new version linked via `supersedes_document_id`.

---

## Final Improvement / Refactor Checklist

Use this checklist before portfolio submission or production deployment.

1. **Review `current_step` design**
   - Currently uses `"fully_registered"` as a sentinel when all clearances are done (the DB column is `NOT NULL`).
   - Decide whether to make `current_step` nullable (requires migration) or keep the sentinel string.

2. **Review overall workflow status naming**
   - Confirm `in_progress`, `correction_required`, `rejected`, `in_person_required`, `fully_registered` are clear for the frontend and users.

3. **Review database constraints**
   - Check NOT NULL fields are appropriate.
   - Check indexes cover common queries.
   - Check ON DELETE behaviors match expected cascade/restrict rules.
   - Confirm duplicate-prevention rules (unique constraints) are in place.

4. **Review API responses**
   - Confirm the frontend receives all data it needs without extra roundtrips.
   - Check for confusing or redundant field names.
   - Ensure `download_url` is always usable from the frontend.

5. **Review security**
   - Student access rules: students can only see/upload their own data.
   - Official role permissions: officials can only update their assigned clearance.
   - File upload safety: extension validation, content-type check, size limit, path traversal guard.
   - JWT expiry and behavior when token is revoked.
   - Raw file paths are never returned in API responses.

6. **Review tests**
   - Add missing edge cases (e.g., file missing on disk, magic byte validation).
   - Test the full workflow: student submits → registrar approves → all offices clear → fully registered.
   - Test commuter vs. residential paths explicitly.
   - Test document replacement and access control thoroughly.

7. **Review README**
   - Clean it up for portfolio or demo use.
   - Remove or hide internal developer notes.

8. **Review frontend user experience**
   - Confirm students can clearly see which clearances are ready, locked, or need action.
   - Confirm officials can see their queue efficiently.
   - Confirm document upload feedback is clear.
   - Consider adding a progress indicator for the full registration flow.
