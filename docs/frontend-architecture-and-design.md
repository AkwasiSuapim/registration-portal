# Frontend Architecture and Design

This describes how the frontend is put together and the design decisions
behind it. It's written from the current code in `frontend/src/` and the
design artifacts in `frontend/docs/design/` — where something was a design
intention that the code doesn't (yet) fully carry out, it's labeled
explicitly as **design intent** rather than presented as shipped behavior.

## The five interfaces

The frontend is one React/Vite application, routed by role, with five
primary surfaces:

1. **Public landing page** (`pages/Home.jsx`) — explains the portal and
   links to Login/Start Registration. No account required.
2. **Unified login page** (`pages/Login.jsx`) — one identifier field, one
   password field, no role selector (see
   [DECISIONS.md](./DECISIONS.md#no-role-selector-on-login)).
3. **Student Workspace** (`pages/StudentPortal.jsx`) — registration wizard,
   status, clearances, documents, activity.
4. **Official Workspace** (`pages/AdminDashboard.jsx`, official branch) —
   one reusable workspace, scoped to whichever office the signed-in
   official belongs to.
5. **Admin Workspace** (`pages/AdminWorkspace.jsx`) — dashboard, user
   management, office assignments.

`AdminDashboard.jsx` is the historical name for the shell that renders
*either* the Official Workspace *or*, for an `admin` session, delegates to
`AdminWorkspace.jsx` — the name predates the admin build-out and was kept
to avoid an unrelated rename.

## Design process

The visual design went through a design-first process before
implementation: `frontend/docs/design/` contains dedicated design-canvas
files for the landing page, login page, and student workspace
(`Registration Portal Landing.dc.html`, `Portal Login.dc.html`, `Student
Workspace.dc.html`, plus a shared `Design System.dc.html`), each with its
own asset set. The shipped CSS follows that direction rather than being
designed ad hoc alongside the components.

## Visual language

There's no formal design-token file (no `:root` CSS custom properties) —
colors are applied directly and consistently across the stylesheets. The
palette in practice, read from `App.css` and the per-workspace stylesheets:

| Role | Color | Used for |
|---|---|---|
| Primary text | `#15191C` | Near-black, not pure black — headings, body text |
| Secondary text | `#5D6870` | Muted slate gray — subtitles, meta text |
| Accent / interactive | `#2F5A6B` | Deep steel blue — links, focus rings, primary actions |
| Accent surface | `#DCEAF0`, `#8CB0BF` | Columbia-blue-toned backgrounds and borders for active/selected states |
| Neutral border | `#d3dee2`, `#dce3e6` | Card and input borders |
| Surface | `#FFFFFF` on a soft blue-gray page background | Content cards |

This is the "institutional blue / Columbia blue / deep navy / soft
blue-gray" direction described in the design process — verified against
the actual CSS values above, not just the design brief.

Status colors (approved/pending/rejected/etc.) come from
`utils/backendLabels.js`'s `statusSlug()`, which maps a backend status
string to a CSS class — so the same backend value always renders the same
color everywhere it appears, across all three workspaces.

## Shared design system, not three separate ones

Every workspace is built from the same primitives rather than each
reinventing its own:

- **Shell layout** — `.workspace` / `.workspace-shell` /
  `.workspace-sidebar` / `.workspace-main` (`App.css`) is shared by the
  Student, Official, and Admin workspaces. `WorkspaceNav.jsx` renders as a
  sticky sidebar on desktop and a bottom tab bar on mobile from the same
  item list, reused with a different `items` prop per workspace.
- **Cards, buttons, badges** — `.workspace-card`, `.btn`/`.btn--primary`/
  `.btn--outline`, and `StatusBadge.jsx` (driven by `statusSlug()`) are
  used identically everywhere a card, action, or status needs to render.
- **Confirmation dialogs** — `official/ConfirmDialog.jsx` is a generic
  confirm/cancel modal, reused by the Admin Workspace's office-reassignment
  and account activate/deactivate flows rather than each building its own.
- **Forms** — `.form-field`/`.form-grid`/`.validation-summary` (originally
  built for the registration flow) are reused by the Admin Workspace's
  Add/Edit Student and Add/Edit Official forms.
- **Per-workspace CSS files** (`officialWorkspace.css`, `adminWorkspace.css`,
  `registrationWizard.css`) only add what the shared system doesn't already
  cover — new status-badge colors, a claim/office grid, upload-slot styling
  — rather than redefining the base system.

## Frontend ↔ backend contract

The frontend service layer is the only thing that talks to the backend:

- `services/api.js` — the shared `request()`/`requestForm()` helpers (auth
  header, error normalization, `VITE_API_BASE_URL`), plus every legacy and
  cross-cutting endpoint call (auth, the one-shot application flow,
  documents, notifications, audit).
- `services/adminApi.js` — every `/admin/*` call.
- `services/registrationApi.js` — every `/registrations/*` call.

No component calls `fetch()` directly, and no component holds a database
credential or query — the frontend only ever knows how to ask the backend
for something, never how to get it itself. Everything a screen displays as
role, status, clearance state, document list, or completion is exactly
what the backend returned on the most recent call — the frontend never
computes or assumes one of these values locally (see
[DECISIONS.md](./DECISIONS.md#backend-is-the-source-of-truth-always)).

## The registration wizard

`components/registration/RegistrationWizard.jsx` is the most stateful part
of the frontend. On mount it fetches or creates the student's draft
(`GET`/`POST /registrations`), and `registrationAdapter.js` translates
between the wizard's local form state and the backend's per-section save
payloads (`PATCH /registrations/{id}/sections/{section}`) — see
[WORKFLOW.md](./WORKFLOW.md#5-the-seven-step-wizard) for the full step-to-
section mapping.

A same-tab `sessionStorage` buffer (`useRegistrationDraft.js`) still exists
underneath the backend draft — it protects whatever's typed into the
*current* step before the student clicks Save & Continue from being lost
to an accidental reload. It is not a substitute for the backend draft;
resuming on a different day or device works because the backend has the
saved data, not because of this buffer.

## Navigation

The app uses `react-router-dom`, not a hand-rolled tab system. Session
state and role come from `App.jsx`, refreshed via `GET /auth/me` on load.
Route guards redirect based on that real session:

- An unauthenticated visitor hitting a protected route is sent to Login
  with the intended destination carried as an internal-only return path
  (`utils/safePath.js`'s `isSafeInternalPath` rejects anything that isn't a
  same-origin path — no open-redirect risk).
- After login, `Login.jsx` returns the student to that destination if it
  was safe and the account is actually a student; otherwise it goes to
  that role's own default workspace.
- An official or admin landing on the student Registration route (or a
  student landing on `/admin`) gets an "Unauthorized" message with a link
  to their own workspace, not a silent redirect and not the protected
  content.

As covered in [ARCHITECTURE.md](./ARCHITECTURE.md#role-based-access), every
one of these frontend redirects is a convenience — the backend enforces the
same rule independently on every request regardless of how the UI routed
the visitor there.

## States every screen accounts for

Built into the shared components and reused per workspace rather than
invented per screen:

- **Loading** — `.workspace-skeleton` (a labeled spinner plus placeholder
  blocks), used consistently across all three workspaces' data-fetching
  screens.
- **Empty** — `.workspace-empty`, distinct from an error (e.g. "no
  applications yet" vs. "couldn't load applications").
- **Error with retry** — `.workspace-error`, always paired with a retry
  action that re-runs the same fetch rather than requiring a page reload.
- **Validation errors** — `.validation-summary` / `.reg-validation` render
  both client-side check failures and backend-returned validation messages
  through the same UI, grouped at the top of the form/step they apply to.
- **Permission denied** — the `AccessRequired`/"Unauthorized" component in
  `App.jsx`, distinct from "you're not logged in."
- **Success** — a consistent success-banner pattern (`.official-success-
  banner`) after an action completes (a clearance decision, an account
  status change, an office reassignment).
- **Submitting/disabled buttons** — action buttons disable and relabel
  (e.g. "Saving…", "Submitting…") while a request is in flight, guarding
  against duplicate submissions from a double-click.

## Accessibility and responsiveness

Verified in the code, not just intended: `focus-visible` outline styles are
defined in five separate stylesheets (App.css, siteChrome.css, and each
per-workspace CSS file) rather than left to the browser default; `aria-`
attributes (`aria-label`, `aria-live`, `aria-expanded`, `aria-modal`,
`role="alert"`/`role="dialog"`, etc.) appear across roughly two dozen
component files; and `@media` responsive rules appear in every major
stylesheet, collapsing the sidebar navigation to a bottom tab bar and
tables to stacked cards below the tablet breakpoint. This wasn't audited
against a formal accessibility standard (e.g. WCAG conformance testing) —
that would be future work — but the patterns above are real, not aspirational.

## Design intent not yet fully realized

Called out explicitly so it isn't mistaken for shipped behavior:

- **Forced password-change screen** — `must_change_password` is present in
  session data (see [DECISIONS.md](./DECISIONS.md)) but no frontend screen
  currently forces a password change before continuing.
- **Some wizard fields have no backend column** — health details beyond
  the emergency contact, a scholarship e-signature, and a residence
  hall/room number are collected in the UI and saved (as flexible JSON
  under `Application.section_data`) but are not structured, queryable
  backend fields the way major/classification/courses are. They round-trip
  correctly across a refresh but aren't reportable data yet.
- **Two upload slots share one backend document category** — the health
  card and the business-office payment proof both save as the backend's
  generic `other` document type, since there's no dedicated category for
  either. On resuming a draft, only unambiguous document types are
  automatically matched back to their slot.
