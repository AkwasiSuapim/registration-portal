/* -------------------------------------------------------
   adminApi.js — service interface for the Admin Workspace.

   Every function here is a real, addressable backend endpoint call —
   built the same way as services/api.js (same request() helper, same
   auth header, same ApiError shape). As of this writing the backend
   does not yet implement most of the paths below; each is still
   defined with its intended method, path, and payload shape so the
   Admin Workspace UI is ready to work the moment the backend adds it.

   isMissingEndpoint(err) tells a screen whether a failure means "this
   capability hasn't been built on the backend yet" (a plain FastAPI
   404 for a route that doesn't exist at all — the framework's own
   `{"detail":"Not Found"}` body) versus a real, meaningful 404 from an
   endpoint that DOES exist (e.g. "Student not found.", which every
   route in services/api.js already returns with its own specific
   detail string). Screens use this to show an honest "not available
   yet" panel instead of a misleading "not found" message.

   See the final implementation report for the full list of endpoints
   below that are missing today, and why each one is needed.
------------------------------------------------------- */
import { request, buildQueryString, ApiError } from './api'

export function isMissingEndpoint(err) {
  return err instanceof ApiError && err.status === 404 && err.detail?.detail === 'Not Found'
}

/* -------------------------------------------------------
   Dashboard
------------------------------------------------------- */
// GET /admin/dashboard/summary — MISSING (backend has no admin dashboard
// summary endpoint). Intended shape:
//   {
//     total_students, active_officials, registrations_in_progress,
//     completed_registrations, blocked_applications, pending_clearances,
//     registration_progress_by_office: [
//       { role_key, role_name, ready, pending, completed }
//     ]
//   }
export async function getAdminDashboardSummary() {
  return request('/admin/dashboard/summary')
}

/* -------------------------------------------------------
   User directory (students + officials)
------------------------------------------------------- */
// GET /admin/users — MISSING. Intended query params: search, role
// ('student' | 'official'), status ('active' | 'inactive'), office
// (role_key, officials only), page, page_size. Intended response:
//   { items: [{ id, user_id, account_type, first_name, last_name,
//               id_number, email, role_name, office_role_key,
//               is_active, updated_at, latest_application_id }],
//     total, page, page_size }
// `id` is the Student/Official profile id (used to build Edit links);
// `user_id` is the users.id row that PATCH /admin/users/{id}/status
// actually operates on — the two are different rows in the schema.
export async function listAdminUsers(params) {
  return request(`/admin/users${buildQueryString(params)}`)
}

/* -------------------------------------------------------
   Students
------------------------------------------------------- */
// GET /admin/students/{id} — MISSING. Full student profile for the Edit
// Student form (prefill) and Account Information on the Student Record.
export async function getAdminStudent(studentId) {
  return request(`/admin/students/${studentId}`)
}

// POST /admin/students — MISSING. Body mirrors the Student model:
// { student_no, first_name, last_name, livingstone_email, major,
//   classification, residency_type }
export async function createStudentAccount(data) {
  return request('/admin/students', { method: 'POST', body: data })
}

// PATCH /admin/students/{id} — MISSING. Same body shape as create,
// any subset of fields.
export async function updateStudentAccount(studentId, data) {
  return request(`/admin/students/${studentId}`, { method: 'PATCH', body: data })
}

/* -------------------------------------------------------
   Officials
------------------------------------------------------- */
// GET /admin/officials/{id} — MISSING. Full official profile for the
// Edit Official form (prefill).
export async function getAdminOfficial(officialId) {
  return request(`/admin/officials/${officialId}`)
}

// POST /admin/officials — MISSING. Body:
// { first_name, last_name, staff_email, office_phone, office_role_key }
export async function createOfficialAccount(data) {
  return request('/admin/officials', { method: 'POST', body: data })
}

// PATCH /admin/officials/{id} — MISSING. Same body shape as create,
// any subset of fields (office re-assignment goes through
// reassignOfficial below instead, since it needs its own confirmation
// step and audit trail).
export async function updateOfficialAccount(officialId, data) {
  return request(`/admin/officials/${officialId}`, { method: 'PATCH', body: data })
}

/* -------------------------------------------------------
   Account status — activate / deactivate (never permanent delete)
------------------------------------------------------- */
// PATCH /admin/users/{id}/status — MISSING. Body: { is_active }.
// {id} is the users.id (not the Student/Official profile id) since
// is_active lives on the User row for both account types.
export async function setUserActiveStatus(userId, isActive) {
  return request(`/admin/users/${userId}/status`, { method: 'PATCH', body: { is_active: isActive } })
}

/* -------------------------------------------------------
   Office assignments
------------------------------------------------------- */
// GET /admin/offices — MISSING. Intended response:
//   { offices: [{ role_key, role_name, officials: [{ id, name, email, is_active }] }],
//     unassigned: [{ id, name, email, is_active }] }
// ("unassigned" would only ever be populated if an official account
// could exist without a role — today role_id is required at signup,
// so this is here for completeness once the backend defines it.)
export async function getOfficeAssignments() {
  return request('/admin/offices')
}

// PATCH /admin/officials/{id}/office — MISSING. Body: { office_role_key }.
export async function reassignOfficial(officialId, officeRoleKey) {
  return request(`/admin/officials/${officialId}/office`, {
    method: 'PATCH',
    body: { office_role_key: officeRoleKey },
  })
}
