/* -------------------------------------------------------
   navbarHelpers.js
   -----------------------
   Small, presentation-only helpers used only by Navbar.jsx. These
   derive a role and a couple of display strings from the authenticated
   session the backend already returned (GET /auth/me / login response)
   — nothing here identifies or hardcodes a specific person, and no
   role/office is ever chosen by the frontend.
------------------------------------------------------- */

// currentSession.role_name is already a real, human-readable office
// name from the backend (e.g. "Welcome Desk / Registrar",
// "Business Office / Cashier"). This map only shortens a few of those
// to the plain labels used in the header — keyed by role_key (a fixed,
// backend-defined enum), never by a person — so it stays accurate no
// matter which official is signed in.
const OFFICE_SHORT_LABELS = {
  registrar:       'Registrar',
  health_services: 'Health Services',
  success_center:  'Success Center',
  financial_aid:   'Financial Aid',
  business_office: 'Business Office',
  residence_life:  'Residence Life',
  public_safety:   'Public Safety',
}

// Four possible header layouts — derived every render from
// currentSession.account_type, never stored or chosen by the user.
export function deriveNavRole(currentSession) {
  if (!currentSession) return 'public'
  if (currentSession.account_type === 'student') return 'student'
  if (currentSession.account_type === 'official') return 'official'
  if (currentSession.account_type === 'admin') return 'admin'
  return 'public'
}

// Falls back to the backend's own role_name if a role_key isn't in the
// short-label table above, so an office added later still shows
// something correct instead of disappearing.
export function deriveOfficeLabel(currentSession) {
  return OFFICE_SHORT_LABELS[currentSession?.role_key] || currentSession?.role_name || 'Official'
}

// The backend has no first/last name field on CurrentUserResponse for
// students or officials (see backend/app/schemas/auth.py) — only an
// account email. This mirrors the same "derive a friendly name from
// the email" convention already used in StudentPortal.jsx and
// components/official/officialStatus.js, kept local here rather than
// importing a page-level helper from either of those pages.
export function deriveDisplayName(email) {
  if (!email) return 'Account'
  const local = email.split('@')[0] || ''
  const word = local.split(/[._-]/)[0] || local
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : 'Account'
}

// Single-letter initial for the profile avatar fallback — there is no
// first/last name to build a two-letter initial from (see above), and
// no photo field on the Student or Official models, so every account
// shows this fallback today.
export function initialFromName(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?'
}
