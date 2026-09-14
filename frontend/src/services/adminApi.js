/* -------------------------------------------------------
   adminApi.js — service interface for the Admin Workspace.

   Every function here calls a real backend endpoint (see
   backend/app/api/routes/admin.py) — built the same way as
   services/api.js (same request() helper, same auth header, same
   ApiError shape).

   isMissingEndpoint(err) is kept for any future admin capability the
   backend hasn't added yet (e.g. GET /admin/students/{id}/applications
   for multi-term registration history — see the implementation
   report). It tells a screen whether a failure means "not built yet"
   (a plain FastAPI 404 for a route that doesn't exist at all — the
   framework's own `{"detail":"Not Found"}` body) versus a real,
   meaningful 404 from an endpoint that DOES exist.
------------------------------------------------------- */
import { request, buildQueryString, ApiError } from './api'

export function isMissingEndpoint(err) {
  return err instanceof ApiError && err.status === 404 && err.detail?.detail === 'Not Found'
}

/* -------------------------------------------------------
   Dashboard (PHASE A) — GET /admin/dashboard/summary
   Response: { total_students, active_officials, registrations_in_progress,
     completed_registrations, blocked_applications, pending_clearances,
     registration_progress_by_office: [{role_key, role_name, office, ready, pending, completed}],
     recent_activity: [{id, occurred_at, action, success, application_id, student_name}],
     applications_requiring_attention: [{application_id, application_number, student_name,
       overall_status, current_step, updated_at}] }
------------------------------------------------------- */
export async function getAdminDashboardSummary() {
  return request('/admin/dashboard/summary')
}

/* -------------------------------------------------------
   User directory (PHASE B) — GET /admin/users
   params: search, role ('student'|'official'), status ('active'|'inactive'),
   office (OfficeKey, officials only), page, page_size.
   Response: { items: [{ id, user_id, account_type, first_name, last_name,
     id_number, email, role_name, office, is_active, updated_at,
     latest_application_id }], total, page, page_size }
   `id` is the Student/Official profile id (used for Edit links and the
   office-reassignment endpoint); `user_id` is what activate/deactivate
   and PATCH .../users/{id} operate on — the two are different rows.
------------------------------------------------------- */
export async function listAdminUsers(params) {
  return request(`/admin/users${buildQueryString(params)}`)
}

/* -------------------------------------------------------
   Account creation — POST /admin/users/students, /admin/users/officials
   Both return { id, user_id, account_type, temporary_password, message } —
   the temporary password is returned exactly once, here, and never again.
------------------------------------------------------- */
export async function createStudentAccount(data) {
  return request('/admin/users/students', { method: 'POST', body: data })
}

export async function createOfficialAccount(data) {
  return request('/admin/users/officials', { method: 'POST', body: data })
}

/* -------------------------------------------------------
   Editing — PATCH /admin/users/{user_id} (users.id, not the profile id)
------------------------------------------------------- */
export async function updateUser(userId, data) {
  return request(`/admin/users/${userId}`, { method: 'PATCH', body: data })
}

/* -------------------------------------------------------
   Account status — never permanent delete
------------------------------------------------------- */
export async function activateUser(userId) {
  return request(`/admin/users/${userId}/activate`, { method: 'POST' })
}

export async function deactivateUser(userId) {
  return request(`/admin/users/${userId}/deactivate`, { method: 'POST' })
}

/* -------------------------------------------------------
   Office assignment — PUT /admin/officials/{official_id}/office
   (official_id is the Official profile id — the same `id` GET
   /admin/users returns for an official row).
------------------------------------------------------- */
export async function reassignOfficialOffice(officialId, office) {
  return request(`/admin/officials/${officialId}/office`, { method: 'PUT', body: { office } })
}
