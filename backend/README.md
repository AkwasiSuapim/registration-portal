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
      security.py         # Password hashing and JWT (Phase 4)
    models/               # SQLAlchemy ORM models (Phase 2)
    schemas/              # Pydantic request/response schemas (Phase 2+)
    api/
      deps.py             # Shared FastAPI dependencies (Phase 4)
      routes/
        health.py         # Health check endpoints
        auth.py           # Login and current user (Phase 4)
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
