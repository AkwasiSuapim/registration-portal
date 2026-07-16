/* -------------------------------------------------------
   backendLabels.js
   -----------------------
   The backend returns machine-readable snake_case strings for every
   status/enum field (overall_status, clearance status/availability,
   clearance_key, document_type, etc). This file is the single place
   that turns those into the human-readable labels shown across the
   student portal and official dashboard, so every page displays the
   same wording and the same status-badge colour for the same value.
------------------------------------------------------- */

// Matches the exact keys/casing the prototype's CSS status-badge
// variants and NextStepMessage copy were built around.
const OVERALL_STATUS_LABELS = {
  in_progress:         'In Progress',
  correction_required: 'Correction Required',
  rejected:            'Rejected',
  in_person_required:  'In-Person Required',
  fully_registered:    'Fully Registered',
}

const CLEARANCE_STATUS_LABELS = {
  pending:             'Pending',
  approved:            'Approved',
  correction_required: 'Correction Required',
  rejected:            'Rejected',
  in_person_required:  'In-Person Required',
  not_required:        'Not Required',
}

const AVAILABILITY_LABELS = {
  locked:               'Locked',
  ready:                'Ready for Review',
  completed:            'Completed',
  needs_student_action: 'Needs Your Action',
}

// current_step holds one of these clearance_key values, or the
// "fully_registered" sentinel once every clearance is done.
const CLEARANCE_KEY_LABELS = {
  registrar_check_in: 'Registrar Check-In',
  health_services:    'Health Services',
  success_center:     'Success Center',
  financial_aid:      'Financial Aid',
  business_office:    'Business Office',
  residence_life:     'Residence Life',
  public_safety:      'Public Safety',
  fully_registered:   'Fully Registered',
}

const DOCUMENT_TYPE_LABELS = {
  photo_id:              'Photo ID',
  immunization_record:   'Immunization Record',
  financial_aid_form:    'Financial Aid Form',
  scholarship_agreement: 'Scholarship Agreement',
  housing_form:          'Housing Form',
  transcript:            'Transcript',
  course_schedule:       'Course Schedule',
  other:                 'Other Document',
}

const DOCUMENT_STATUS_LABELS = {
  uploaded:         'Uploaded',
  approved:         'Approved',
  needs_correction: 'Needs Correction',
  rejected:         'Rejected',
}

// Generic fallback for values without a specific mapping above
// (e.g. audit action strings) — "clearance_approve" -> "Clearance approve".
function humanize(value) {
  if (!value) return ''
  const text = value.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatOverallStatus(status) {
  return OVERALL_STATUS_LABELS[status] || humanize(status)
}

export function formatClearanceStatus(status) {
  return CLEARANCE_STATUS_LABELS[status] || humanize(status)
}

export function formatAvailability(availability) {
  return AVAILABILITY_LABELS[availability] || humanize(availability)
}

export function formatClearanceKey(key) {
  return CLEARANCE_KEY_LABELS[key] || humanize(key)
}

export function formatDocumentType(type) {
  return DOCUMENT_TYPE_LABELS[type] || humanize(type)
}

export function formatDocumentStatus(status) {
  return DOCUMENT_STATUS_LABELS[status] || humanize(status)
}

export function formatAction(action) {
  return humanize(action)
}

// CSS slug for any status label — "Correction Required" -> "correction-required".
// Shared so the same status string always maps to the same badge colour
// everywhere it appears (student portal, official queue, review panel).
export function statusSlug(status) {
  if (!status) return 'pending'
  return status.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')
}

export const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

// Maps a logged-in official's role_key to the one clearance_key they're
// allowed to act on — mirrors the backend's own role→clearance mapping
// (workflow_service.py _ROLE_TO_CLEARANCE). Officials may still VIEW every
// clearance on an application's review page; this is only used to decide
// which one they're allowed to act on.
const ROLE_KEY_TO_CLEARANCE_KEY = {
  registrar:        'registrar_check_in',
  health_services:  'health_services',
  success_center:   'success_center',
  financial_aid:    'financial_aid',
  business_office:  'business_office',
  residence_life:   'residence_life',
  public_safety:    'public_safety',
}

export function getOwnClearanceKey(roleKey) {
  return ROLE_KEY_TO_CLEARANCE_KEY[roleKey] || null
}
