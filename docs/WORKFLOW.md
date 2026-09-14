# Product Workflow

This walks through the real, end-to-end flow the system supports today, in
the order it actually happens. Each step names the screen and the API call
behind it so this doubles as a map between the product and the code.

## 1. Public visitor

An unauthenticated visitor can reach the landing page (`Home.jsx`) and the
login page. Nothing else. There is no public sign-up — see
[DECISIONS.md](./DECISIONS.md) for why.

## 2. Login and role redirect

`Login.jsx` shows one form: an identifier field and a password field. There
is no role selector. The visitor submits, `POST /auth/login` resolves the
identifier and returns a JWT plus the account's real role, and the frontend
routes based on `account_type` from that response:

- `student` → Student Workspace
- `official` → Official Workspace (scoped to their one office)
- `admin` → Admin Workspace

If a student clicked "Start Registration" while logged out, the login page
carries a safe internal return path and sends them straight back to
Registration after signing in — see
[frontend-architecture-and-design.md](./frontend-architecture-and-design.md#navigation).

## 3. Admin creates accounts

Before any student or official can log in, an admin creates their account
from the Admin Workspace → User Management screen:

- **Add Student** (`POST /admin/users/students`) — student ID, name, school
  email, and (optional) major/classification/residency type.
- **Add Official** (`POST /admin/users/officials`) — name, school email, and
  exactly one of the seven canonical offices.

Both return a **temporary password, shown once**, that the admin shares with
the new account holder through some channel outside the app (there is no
email-invitation flow — see [DECISIONS.md](./DECISIONS.md)). The new
account's `must_change_password` flag is set to `true`.

Admins can also search/filter the user directory, edit a profile, activate
or deactivate an account (never delete one), and reassign an official's
office — each of those last three requires a confirmation step in the UI.

## 4. Student starts or resumes registration

Opening the Registration tab calls `GET /registrations/current`. Two
outcomes:

- **A draft already exists** (the student started this before, on this
  device or another one) → the wizard loads with everything already saved
  filled back in.
- **No draft exists** → the frontend calls `POST /registrations/`, which is
  idempotent server-side, so a page refresh or a double-click never creates
  a second draft.

## 5. The seven-step wizard

Each step maps to one backend section key:

| Step | Section key | What it collects |
|---|---|---|
| 1. Welcome Desk / Registrar | `welcome_desk` | Identity and contact info, Photo ID upload |
| 2. Health Services | `health_services` | Emergency contact, immunization + health card uploads |
| 3. Success Center | `success_center` | Major, classification, term, course selection (min. 15 credit hours), optional transcript |
| 4. Financial Aid | `financial_aid` | Read-only — shows a Financial Aid document if the office has already uploaded one |
| 5. Business Office / Cashier | `business_office` | Presidential Scholar status; payment plan upload if not a scholar |
| 6. Residence Life | `residence_life` | Housing status (on-campus / commuter), hall, fee receipt upload |
| 7. Review and Submit | `review` | Summary of every section, grouped by office, with an edit link back to each; final confirmation |

**Public Safety is never one of these steps.** It has no online form — see
§8 below.

Clicking **Save & Continue** calls `PATCH
/registrations/{id}/sections/{section}` with that step's data before moving
on — so what's already been entered survives a refresh, a closed tab, or
coming back the next day, not just within the current browser tab.

Client-side validation runs first (required fields, minimum credit hours);
if the backend rejects a save (a real validation failure, a duplicate, a
conflict), the message is shown in the same place the client-side errors
already appear.

## 6. Documents inside each step

A file is uploaded the moment it's selected — `POST
/registrations/{id}/documents` — inside whichever step owns it. There is no
separate "Upload Documents" step. Re-selecting a file for a slot that
already has one uploads a new version rather than losing the first.
Transcript upload (Success Center) is optional and never blocks
progressing to the next step or submitting.

## 7. Final submit

The Review step's button calls `POST /registrations/{id}/submit`. The
backend:

1. Validates every required field is present and total credit hours meet
   the minimum — if not, it returns the full list of what's missing.
2. Creates the seven clearance records for the application (one per
   office, including Public Safety).
3. Sets the Public Safety clearance's status to `IN_PERSON_REQUIRED`
   immediately (see §8).
4. Records an audit log entry and notifies the Registrar's queue.
5. Returns the finalized application plus a `public_safety_instruction`
   object.

The draft disappears from `GET /registrations/current` at this point — it
now shows up in `GET /registrations/history` instead, alongside any past
terms.

## 8. Public Safety: in-person only

Public Safety is not filled out online. From the moment an application is
submitted, its Public Safety clearance exists with:

- `status = IN_PERSON_REQUIRED`
- `availability = LOCKED` (until every other required clearance clears)

The submission response's `public_safety_instruction` object tells the
student to bring a photo ID to the Public Safety Office once their other
clearances are done. The Student Workspace keeps showing this instruction —
derived from the same real clearance data, not a one-time message — until a
Public Safety official completes the in-person verification and the
clearance moves to `approved`.

## 9. Office review, claim, and decision

Each office sees only its own queue (`GET /official/me/queue`) — the office
comes from the logged-in official's account, never a request parameter, so
there's no way to view or act on another office's queue by changing a URL.

An official can:

- **Claim** an item (`POST /official/applications/{id}/claim`) so a
  colleague at the same desk can see it's being handled.
- **Review** the full application (`GET /official/applications/{id}`).
- **Decide** (`POST /official/applications/{id}/decision`): `approve`,
  `request_correction`, or `reject`. `request_correction` and `reject`
  require a message, which the student sees. Approving automatically
  unlocks whichever downstream clearances now have their prerequisite met.

There is no dedicated "resubmit" action distinct from this. If an office
requests a correction, the student's clearance moves to
`needs_student_action`; the student addresses it by re-uploading the
relevant document or contacting the office, and the same office reviews it
again through the normal queue. A formal resubmission flow (a button that
explicitly re-notifies the office) is not implemented.

## 10. Residence Life: residential vs. commuter

- **Residential** students (`housing_required = true`, set from the
  Residence Life step) must have Residence Life approve their clearance
  before Public Safety can open — Public Safety's prerequisite chain
  depends on Residence Life for residential students specifically.
- **Commuter** students have their Residence Life clearance created as
  `not_required` / already `completed` at submission — it never blocks
  anything, and Public Safety's prerequisite becomes Business Office
  approval instead.

This is enforced by a data-driven dependency table
(`clearance_dependencies`), not an if/else scattered through the code — see
[ARCHITECTURE.md](./ARCHITECTURE.md) and
[DECISIONS.md](./DECISIONS.md).

## 11. What "fully registered" means

An application's `overall_status` becomes `fully_registered` only once
every *required* clearance (all seven for a residential student; six plus a
`not_required` Residence Life for a commuter) is `approved` — including
Public Safety's in-person step. Submitting the online form alone never
marks a student fully registered; the frontend never claims completion
locally, it only ever displays whatever status the backend last returned.
