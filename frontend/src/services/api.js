/* -------------------------------------------------------
   api.js — centralized backend API client

   All requests go through request()/requestForm(), which attach the
   JWT (when present), parse JSON responses, and turn backend error
   bodies into a single readable ApiError. Every page should call the
   helper functions below instead of using fetch() directly, so the
   base URL, auth header, and error handling stay in one place.
------------------------------------------------------- */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const TOKEN_KEY = 'registrationPortalToken'
const USER_KEY  = 'registrationPortalUser'

/* -------------------------------------------------------
   Token / cached-user storage
------------------------------------------------------- */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

// Clears the token and any cached user — a token without a matching
// user is not useful, so both are removed together.
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function setCachedUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function logout() {
  clearToken()
}

/* -------------------------------------------------------
   ApiError — one error shape for every failure case, so
   calling code can always read err.message for display and
   err.status when it needs to branch on the HTTP status code.
------------------------------------------------------- */
export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name   = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// Backend errors come in two shapes: a plain string `detail` from
// HTTPException, or an array of { loc, msg, type } from Pydantic
// validation errors. This normalizes both into one readable string.
function extractErrorMessage(data, status) {
  const detail = data?.detail

  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item.msg).filter(Boolean).join(' ')
  }

  const fallbacks = {
    400: 'The request could not be processed.',
    401: 'You need to log in to continue.',
    403: 'You do not have permission to do that.',
    404: 'The requested item could not be found.',
    409: 'This conflicts with existing data.',
    413: 'That file is too large.',
    415: 'That file type is not supported.',
    422: 'Some information was missing or invalid.',
  }

  return fallbacks[status] || 'Something went wrong. Please try again.'
}

export function buildQueryString(params) {
  if (!params) return ''
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  )
  if (entries.length === 0) return ''
  const search = new URLSearchParams()
  for (const [key, value] of entries) search.set(key, value)
  return `?${search.toString()}`
}

/* -------------------------------------------------------
   Core request helper — used by every JSON endpoint

   Exported (alongside buildQueryString) so other service files, such
   as services/adminApi.js, can build additional endpoint functions on
   top of the same base URL / auth header / error handling instead of
   duplicating fetch() plumbing.
------------------------------------------------------- */
export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = auth ? getToken() : null
  if (token) headers['Authorization'] = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(
      'Cannot reach the server. Please check your connection and try again.',
      0,
      null
    )
  }

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    // A 401 on a request that carried a token means the session is no
    // longer valid (expired/invalid) — clear it and let the app know
    // so it can drop back to a logged-out state.
    if (response.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new Event('auth:session-expired'))
    }
    throw new ApiError(extractErrorMessage(data, response.status), response.status, data)
  }

  return data
}

// Multipart form upload — used only for document upload.
async function requestForm(path, formData) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    })
  } catch {
    throw new ApiError(
      'Cannot reach the server. Please check your connection and try again.',
      0,
      null
    )
  }

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new Event('auth:session-expired'))
    }
    throw new ApiError(extractErrorMessage(data, response.status), response.status, data)
  }

  return data
}

/* -------------------------------------------------------
   Auth
------------------------------------------------------- */
export async function login(identifier, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { identifier, password },
    auth: false,
  })
  setToken(data.access_token)
  setCachedUser(data.user)
  return data.user
}

export async function getCurrentUser() {
  const user = await request('/auth/me')
  setCachedUser(user)
  return user
}

/* -------------------------------------------------------
   Student applications
------------------------------------------------------- */
export async function createApplication(applicationData) {
  return request('/applications', { method: 'POST', body: applicationData })
}

export async function getMyApplications() {
  return request('/students/me/applications')
}

export async function getApplication(applicationId) {
  return request(`/applications/${applicationId}`)
}

export async function getApplicationStatus(applicationId) {
  return request(`/applications/${applicationId}/status`)
}

/* -------------------------------------------------------
   Official workflow
------------------------------------------------------- */
export async function getOfficialQueue(params) {
  return request(`/officials/me/queue${buildQueryString(params)}`)
}

export async function getApplicationReview(applicationId) {
  return request(`/applications/${applicationId}/review`)
}

export async function updateClearance(clearanceId, actionData) {
  return request(`/clearances/${clearanceId}`, { method: 'PATCH', body: actionData })
}

/* -------------------------------------------------------
   Documents
------------------------------------------------------- */
export async function uploadDocument(applicationId, documentType, file) {
  const formData = new FormData()
  formData.append('document_type', documentType)
  formData.append('file', file)
  return requestForm(`/applications/${applicationId}/documents`, formData)
}

export async function getApplicationDocuments(applicationId) {
  return request(`/applications/${applicationId}/documents`)
}

export async function downloadDocument(documentId) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE_URL}/documents/${documentId}/download`, { headers })
  } catch {
    throw new ApiError(
      'Cannot reach the server. Please check your connection and try again.',
      0,
      null
    )
  }

  if (!response.ok) {
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // response body wasn't valid JSON — leave data as null
    }
    if (response.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new Event('auth:session-expired'))
    }
    throw new ApiError(extractErrorMessage(data, response.status), response.status, data)
  }

  // Pull the filename the server sent, then trigger a normal browser download.
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : 'download'

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/* -------------------------------------------------------
   Notifications
------------------------------------------------------- */
export async function getNotifications(params) {
  return request(`/notifications${buildQueryString(params)}`)
}

export async function getUnreadNotificationCount() {
  return request('/notifications/unread-count')
}

export async function markNotificationRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'PATCH' })
}

/* -------------------------------------------------------
   Audit / activity
------------------------------------------------------- */
export async function getApplicationActivity(applicationId, params) {
  return request(`/applications/${applicationId}/activity${buildQueryString(params)}`)
}

export async function getAdminAuditLogs(params) {
  return request(`/admin/audit-logs${buildQueryString(params)}`)
}
