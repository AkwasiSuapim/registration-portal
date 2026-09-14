# Development Guide

## Prerequisites

- **Python 3.11 or later**
- **Node.js** (for `npm`) — any recent LTS version works with Vite
- **PostgreSQL 15 or later**, running locally

## 1. Clone and branch

```bash
git clone <repo-url>
cd registration-portal
git checkout develop
```

See [Branch workflow](../README.md#branch-workflow) in the root README
before starting new work.

## 2. Backend setup

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
python -m pip install -r requirements.txt
```

Create your environment file:

```bash
cp .env.example .env
```

Open `.env` and set:

- `DATABASE_URL` — your local PostgreSQL connection string
- `JWT_SECRET_KEY` — any long random string (never reuse the example value)

`backend/.env` is git-ignored — it's never committed.

## 3. Database setup

Create the database once:

```bash
psql -U postgres -c "CREATE DATABASE student_registration_portal;"
```

Apply every migration:

```bash
python -m alembic upgrade head
```

Seed roles, the clearance dependency rules, and (in `ENVIRONMENT=development`
only) demo accounts:

```bash
python -m app.scripts.seed_data
```

This is safe to run more than once — existing rows are skipped, not
duplicated. Demo credentials are listed in
[`backend/README.md`](../backend/README.md#demo-login-accounts-development-only).

## 4. Run the backend

From the `backend/` folder, with the virtual environment active:

```bash
python -m uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`
- Health check: `curl http://localhost:8000/health`

## 5. Frontend setup and run

```bash
cd frontend
npm install
cp .env.example .env   # only needed if the default http://localhost:8000 doesn't fit
npm run dev
```

Frontend: `http://localhost:5173`. It talks to the backend over HTTP —
nothing about the frontend touches PostgreSQL directly (see
[ARCHITECTURE.md](./ARCHITECTURE.md)).

## 6. Run tests and checks

**Backend tests** (hit a real database via `TestClient` — point `.env` at a
database you don't mind test data landing in, and make sure seed data has
been run first):

```bash
cd backend
source venv/bin/activate
pytest -q
```

**Frontend lint and build:**

```bash
cd frontend
npm run lint
npm run build
```

Both are expected to be clean before opening a PR.

## Common troubleshooting

**"command not found: uvicorn" / import errors** — you're not in the
`backend/` folder, or the virtual environment isn't active. Every backend
command in this guide assumes both:

```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

Using `python -m uvicorn ...` (rather than a bare `uvicorn`) avoids picking
up a different Python/uvicorn install on your `PATH`.

**"command not found: vite" / npm errors** — same idea, from `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

**Never commit:** `backend/.env`, `backend/venv/` (or `.venv/`),
`backend/uploads/`, `frontend/node_modules/`, `frontend/dist/`, and any
uploaded PDFs/images from local testing. All of these are already listed in
the root `.gitignore` — if `git status` shows one of them as untracked and
about to be added, stop and check your `.gitignore` before committing.

**Alembic says the database is at a revision it doesn't recognize** (`Can't
locate revision identified by '...'`) — this happens if a migration file
was reverted in git after already being applied to your local database, or
if your database was migrated from a different branch. Check the real
current revision with:

```bash
psql -U postgres -d student_registration_portal -c "select version_num from alembic_version;"
```

...and compare it against the files actually in `backend/alembic/versions/`.
If your database's schema already matches what the latest real migration
file produces, `alembic stamp --purge <that-revision>` re-points Alembic at
the correct history without re-running any SQL — do **not** reach for this
if you're unsure the schema actually matches, since it only edits Alembic's
bookkeeping table, not your data.

**Frontend can't reach the backend / CORS errors** — confirm the backend is
actually running on the port `VITE_API_BASE_URL` points at, and that
`CORS_ORIGINS` in `backend/.env` includes your frontend's origin
(`http://localhost:5173` by default).

## Migrations at a glance

| Revision | Adds |
|---|---|
| `396445a00e4f` | The full initial schema: roles, users, students, officials, applications, courses, clearances, clearance dependencies, documents, notifications, audit logs. |
| `bbd08d7f2818` | `users.must_change_password`; draft-registration support on `applications` (`section_data`, nullable term/major/etc., `'draft'` status); clearance claim tracking (`claimed_by_official_id`, `claimed_at`). |
| `38f2b241b030` | Removes the database-level default on `applications.submitted_at` so a draft genuinely has no submission timestamp instead of one being silently assigned. |

Generate a new one with `alembic revision --autogenerate -m "..."` after
changing a model, review the generated file by hand (autogenerate misses
things like `CheckConstraint` body changes), then `alembic upgrade head`.
