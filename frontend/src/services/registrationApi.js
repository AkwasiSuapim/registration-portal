/* -------------------------------------------------------
   registrationApi.js — service interface for the student Registration
   Wizard's draft-based backend (backend/app/api/routes/registrations.py).

   Built the same way as services/adminApi.js — reuses api.js's shared
   request() helper (same base URL, auth header, ApiError shape) instead
   of scattering fetch() calls across components. api.js's own legacy
   application endpoints (createApplication, getMyApplications,
   uploadDocument, etc.) are untouched and still used elsewhere (the
   Documents/Activity/Clearances tabs, and anything still on the old
   POST /applications flow).
------------------------------------------------------- */
import { request, requestForm, ApiError } from './api'

// True only for the framework's own "no such route" 404 — used to tell
// "no draft exists yet" (GET /registrations/current, a real, documented
// 404 with its own detail message) apart from "this endpoint doesn't
// exist" during development. Not expected to ever fire in production
// since every path used here is implemented.
export function isMissingEndpoint(err) {
  return err instanceof ApiError && err.status === 404 && err.detail?.detail === 'Not Found'
}

// True for GET /registrations/current's real "no draft in progress" 404
// (detail: "No registration in progress.") — the normal, expected
// response for a student who hasn't started a registration yet.
export function isNoDraftError(err) {
  return err instanceof ApiError && err.status === 404 && !isMissingEndpoint(err)
}

/* -------------------------------------------------------
   Draft lifecycle
------------------------------------------------------- */
export async function getCurrentRegistration() {
  return request('/registrations/current')
}

// Idempotent on the backend — a student can only ever have one open
// draft, so calling this when one already exists just returns it
// instead of creating a duplicate (see PHASE C requirement: "Do not
// create duplicate drafts").
export async function startRegistration() {
  return request('/registrations/', { method: 'POST' })
}

export async function saveRegistrationSection(applicationId, section, data) {
  return request(`/registrations/${applicationId}/sections/${section}`, {
    method: 'PATCH',
    body: { data },
  })
}

export async function submitRegistration(applicationId) {
  return request(`/registrations/${applicationId}/submit`, { method: 'POST' })
}

export async function getRegistrationHistory() {
  return request('/registrations/history')
}

export async function getRegistrationClearances(applicationId) {
  return request(`/registrations/${applicationId}/clearances`)
}

/* -------------------------------------------------------
   Documents — mirrors api.js's getApplicationDocuments/uploadDocument
   but under the /registrations path (same underlying document_service
   validation: ownership, category, file type, size).
------------------------------------------------------- */
export async function getRegistrationDocuments(applicationId) {
  const result = await request(`/registrations/${applicationId}/documents`)
  return result.documents
}

// Multipart upload — reuses api.js's own requestForm (same auth header,
// same error handling as every other upload in the app) against the
// /registrations path instead of /applications.
export async function uploadRegistrationDocument(applicationId, documentType, file) {
  const formData = new FormData()
  formData.append('document_type', documentType)
  formData.append('file', file)
  return requestForm(`/registrations/${applicationId}/documents`, formData)
}
