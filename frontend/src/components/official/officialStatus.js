/* -------------------------------------------------------
   officialStatus.js
   -----------------------
   Maps a raw OfficialQueueItemResponse (backend clearance_status /
   clearance_availability) plus local claim state (officialLocalState.js)
   onto the seven display statuses this workspace uses consistently:

     New · In Review · Correction Requested · Resubmitted ·
     Approved · Rejected · In-Person Required

   "In Review" has no backend column — it is derived from a local claim
   (see officialLocalState.js). "Resubmitted" has no backend signal at
   all: nothing on OfficialQueueItemResponse records that a student
   re-uploaded a document after a correction request, so it can never
   be computed here — see STATUS_LABELS.resubmitted usage in
   OfficialDashboardTab.jsx for how that gap is surfaced honestly
   instead of guessed at.
------------------------------------------------------- */

export const STATUS_LABELS = {
  new: 'New',
  in_review: 'In Review',
  correction_required: 'Correction Requested',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  rejected: 'Rejected',
  in_person_required: 'In-Person Required',
}

// Items in these backend states are not part of this office's actionable
// queue at all: 'locked' means a prerequisite clearance hasn't cleared
// yet, and 'not_required' means this office is skipped for this student
// (e.g. Residence Life for a commuter).
export function isQueueRelevant(item) {
  return item.clearance_availability !== 'locked' && item.clearance_status !== 'not_required'
}

export function computeItemStatus(item, claimed) {
  switch (item.clearance_status) {
    case 'approved':            return 'approved'
    case 'rejected':            return 'rejected'
    case 'in_person_required':  return 'in_person_required'
    case 'correction_required': return 'correction_required'
    case 'pending':
    default:
      return claimed ? 'in_review' : 'new'
  }
}

export const OPEN_STATUSES = ['new', 'in_review', 'correction_required']
export const COMPLETED_STATUSES = ['approved', 'rejected', 'in_person_required']

// Short letter mark shown when a student has no profile picture — the
// backend Student model has no photo field, so every card uses this
// (see the Official Dashboard section of the feature's final summary).
export function studentInitials(studentName) {
  const letters = (studentName || '').trim().split(/\s+/).map((part) => part[0]).filter(Boolean)
  return (letters.slice(0, 2).join('') || '?').toUpperCase()
}

// Same "derive a friendly name from the account email" convention
// StudentPortal.jsx uses — the backend's CurrentUserResponse has no
// first/last name field for officials either.
export function deriveOfficialDisplayName(email) {
  if (!email) return 'Official'
  const local = email.split('@')[0] || ''
  const word = local.split(/[._-]/)[0] || local
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : 'Official'
}

/* -------------------------------------------------------
   Dashboard filters — single-select, "Assigned to Me" is the default.
   `unassigned`/`assigned_to_me` reflect local claims only (see
   officialLocalState.js) — they cannot see another staff member's
   claims made on a different device/browser, which is reported as a
   missing API capability rather than presented as a shared, live
   assignment system.
------------------------------------------------------- */
export const DASHBOARD_FILTERS = [
  { value: 'assigned_to_me',      label: 'Assigned to Me' },
  { value: 'unassigned',          label: 'Unassigned' },
  { value: 'new',                 label: 'New' },
  { value: 'in_review',           label: 'In Review' },
  { value: 'correction_required', label: 'Correction Requested' },
  { value: 'resubmitted',         label: 'Resubmitted' },
  { value: 'completed',           label: 'Completed' },
]

export function matchesFilter(filterValue, status, claimed) {
  switch (filterValue) {
    case 'assigned_to_me':      return claimed
    case 'unassigned':          return !claimed && OPEN_STATUSES.includes(status)
    case 'new':                 return status === 'new'
    case 'in_review':           return status === 'in_review'
    case 'correction_required': return status === 'correction_required'
    // No backend event records a student resubmission — see this
    // filter's empty-state copy in OfficialDashboardTab.jsx.
    case 'resubmitted':         return false
    case 'completed':           return COMPLETED_STATUSES.includes(status)
    default:                    return true
  }
}

export function matchesSearch(item, term) {
  if (!term) return true
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return (
    (item.student_name || '').toLowerCase().includes(needle) ||
    (item.student_no || '').toLowerCase().includes(needle) ||
    (item.application_number || '').toLowerCase().includes(needle)
  )
}

export function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDateTime(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
