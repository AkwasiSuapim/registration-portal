/*
  registrationWorkflow.js
  -----------------------
  Shared business logic for the digital version of the physical
  Livingstone College registration validation card.

  Physical process: students walk from office to office collecting
  signatures/stamps from each station.
  Digital equivalent: each office updates its assigned clearance online,
  and students can track their overall registration status in real time.
*/

/* -------------------------------------------------------
   Clearance keys — one entry per office, in typical
   registration-card order
------------------------------------------------------- */
export const CLEARANCE_KEYS = [
  'registrarCheckIn',
  'healthServices',
  'successCenter',
  'financialAid',
  'businessOffice',
  'residenceLife',
  'publicSafety',
]

/* -------------------------------------------------------
   Human-readable labels for each clearance key
------------------------------------------------------- */
const CLEARANCE_LABELS = {
  registrarCheckIn: 'Registrar Check-In Clearance',
  healthServices:   'Health / Immunization Clearance',
  successCenter:    'Academic / Course Registration Clearance',
  financialAid:     'Financial Aid Clearance',
  businessOffice:   'Business Office / Payment Validation',
  residenceLife:    'Housing / Residence Life Clearance',
  publicSafety:     'Public Safety / ID Clearance',
}

export function getClearanceLabel(clearanceKey) {
  return CLEARANCE_LABELS[clearanceKey] || clearanceKey
}

/* -------------------------------------------------------
   Office roles — the seven stations in the physical
   registration-card process, now mapped to digital clearances.
   Each role can update exactly one assigned clearance section.
------------------------------------------------------- */
export const OFFICE_ROLES = [
  'Welcome Desk / Registrar',
  'Health Services',
  'Success Center',
  'Financial Aid',
  'Business Office / Cashier',
  'Residence Life',
  'Public Safety',
]

// Role-to-clearance mapping — mirrors the physical card:
// each station stamps only its own section.
const officeRoleToClearance = {
  'Welcome Desk / Registrar':  'registrarCheckIn',
  'Health Services':           'healthServices',
  'Success Center':            'successCenter',
  'Financial Aid':             'financialAid',
  'Business Office / Cashier': 'businessOffice',
  'Residence Life':            'residenceLife',
  'Public Safety':             'publicSafety',
}

export function getAllowedClearanceForRole(officeRole) {
  return officeRoleToClearance[officeRole] || null
}

// Backward-compatible alias — used by AdminDashboard until Phase 4 updates it
export const getAllowedClearanceKey = getAllowedClearanceForRole

/* -------------------------------------------------------
   Default clearances — new submissions start with all
   seven clearances in Pending state
------------------------------------------------------- */
function buildDefaultClearance(key) {
  return {
    label:      CLEARANCE_LABELS[key],
    status:     'Pending',
    message:    '',
    reviewedBy: '',
    reviewedAt: '',
  }
}

export function getDefaultClearances() {
  const clearances = {}
  for (const key of CLEARANCE_KEYS) {
    clearances[key] = buildDefaultClearance(key)
  }
  return clearances
}

/* -------------------------------------------------------
   Overall status calculation
   Rules are applied in priority order:
   1. Any clearance Rejected            → Rejected
   2. Any clearance Correction Required → Correction Required
   3. All others Approved + publicSafety is In-Person Required → In-Person Required
   4. All clearances Approved           → Fully Registered
   5. Otherwise                         → In Progress
------------------------------------------------------- */
export function calculateOverallStatus(applicationOrClearances) {
  // Accept either a full application object { clearances: {...} }
  // or a raw clearances map — keeps backward compatibility with
  // existing AdminDashboard calls that pass clearances directly
  const clearances  = applicationOrClearances?.clearances ?? applicationOrClearances
  if (!clearances) return 'In Progress'

  const statusOf    = (key) => clearances[key]?.status || 'Pending'
  const allStatuses = CLEARANCE_KEYS.map(statusOf)

  if (allStatuses.some((s) => s === 'Rejected'))            return 'Rejected'
  if (allStatuses.some((s) => s === 'Correction Required')) return 'Correction Required'

  // Public Safety may require an in-person visit for photo ID processing.
  // If all other offices have approved and only Public Safety needs the
  // in-person step, surface that as its own status so the student knows
  // exactly what action to take next.
  const nonPublicSafetyKeys = CLEARANCE_KEYS.filter((k) => k !== 'publicSafety')
  const allOthersApproved   = nonPublicSafetyKeys.every((k) => statusOf(k) === 'Approved')
  if (statusOf('publicSafety') === 'In-Person Required' && allOthersApproved) {
    return 'In-Person Required'
  }

  if (allStatuses.every((s) => s === 'Approved')) return 'Fully Registered'
  return 'In Progress'
}

/* -------------------------------------------------------
   Application normalisation
   Older applications saved under the previous 5-office format
   will be missing the new clearance keys.  We add defaults
   so the dashboard and portal never crash on old data.
------------------------------------------------------- */
export function normalizeApplication(application) {
  const existing   = application.clearances || {}
  const normalized = {}

  for (const key of CLEARANCE_KEYS) {
    // Keep any existing clearance data; fill in missing keys with defaults
    normalized[key] = existing[key] || buildDefaultClearance(key)
  }

  return {
    ...application,
    clearances:    normalized,
    overallStatus: calculateOverallStatus(normalized),
  }
}

export function normalizeApplications(applications) {
  return applications.map(normalizeApplication)
}

/* -------------------------------------------------------
   getClearanceEntries — returns an ordered array of
   { key, label, clearance } objects so pages can render
   the clearance tracker without manually iterating CLEARANCE_KEYS
------------------------------------------------------- */
export function getClearanceEntries(application) {
  const clearances = application?.clearances || {}
  return CLEARANCE_KEYS.map((key) => ({
    key,
    label:     getClearanceLabel(key),
    clearance: clearances[key] || buildDefaultClearance(key),
  }))
}

/* -------------------------------------------------------
   Validation helpers — shared by Login.jsx and StudentForm
------------------------------------------------------- */

// Student ID: must start with 100 and be exactly 9 digits total
export function isValidStudentId(identifier) {
  return /^100\d{6}$/.test(identifier.trim())
}

// Student email: must use the official student domain
export function isValidStudentEmail(identifier) {
  return identifier.trim().toLowerCase().endsWith('@student.livingstone.edu')
}

// Staff email: must use the staff domain, not the student subdomain
export function isValidStaffEmail(email) {
  const lower = email.trim().toLowerCase()
  return lower.endsWith('@livingstone.edu') && !lower.endsWith('@student.livingstone.edu')
}

// Returns true if the identifier is a valid student login value —
// either a correctly-formatted student ID or a valid student email
export function isEduStudentIdentifier(identifier) {
  return isValidStudentId(identifier) || isValidStudentEmail(identifier)
}

/* -------------------------------------------------------
   localStorage helpers
------------------------------------------------------- */
export const STORAGE_KEY = 'studentRegistrationApplications'

export function loadApplications() {
  try {
    // Migrate legacy data saved under the old key ('registrations')
    const legacy  = JSON.parse(localStorage.getItem('registrations') || '[]')
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY)    || '[]')

    if (legacy.length > 0 && current.length === 0) {
      const migrated = normalizeApplications(legacy)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      localStorage.removeItem('registrations')
      return migrated
    }

    return normalizeApplications(current)
  } catch {
    return []
  }
}

export function saveApplications(applications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
  } catch {
    // localStorage may be unavailable in some restricted browser contexts
  }
}
