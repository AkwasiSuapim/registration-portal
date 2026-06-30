/*
  registrationWorkflow.js
  -----------------------
  Shared business logic for the office-based clearance workflow.

  Each submitted application goes through five clearance offices before
  a student is considered fully registered.  This file holds all the
  constants and pure functions that both the AdminDashboard and the
  StudentPortal need so the logic is never duplicated.
*/

/* -------------------------------------------------------
   Clearance keys — one entry per office, in review order
------------------------------------------------------- */
export const CLEARANCE_KEYS = [
  'admissions',
  'financialAid',
  'healthClinic',
  'academicAdvisor',
  'registrar',
]

/* -------------------------------------------------------
   Clearance labels — human-readable name for each key
------------------------------------------------------- */
const CLEARANCE_LABELS = {
  admissions:      'Admissions Clearance',
  financialAid:    'Financial Clearance',
  healthClinic:    'Health Clearance',
  academicAdvisor: 'Advisor Clearance',
  registrar:       'Registrar Final Review',
}

export function getClearanceLabel(clearanceKey) {
  return CLEARANCE_LABELS[clearanceKey] || clearanceKey
}

/* -------------------------------------------------------
   Office role → clearance key mapping.
   Each office can only update the clearance assigned to its role.
------------------------------------------------------- */
export const OFFICE_ROLES = [
  'Admissions Office',
  'Financial Aid',
  'Health Clinic',
  'Academic Advisor',
  'Registrar',
]

const officeRoleToClearance = {
  'Admissions Office': 'admissions',
  'Financial Aid':     'financialAid',
  'Health Clinic':     'healthClinic',
  'Academic Advisor':  'academicAdvisor',
  'Registrar':         'registrar',
}

// Returns the clearance key this office role is allowed to update,
// or null if the role is unrecognised.
export function getAllowedClearanceKey(officeRole) {
  return officeRoleToClearance[officeRole] || null
}

/* -------------------------------------------------------
   Default clearance object — Pending status, empty fields
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

// Returns a fresh clearances object with every section set to Pending.
export function getDefaultClearances() {
  const clearances = {}
  for (const key of CLEARANCE_KEYS) {
    clearances[key] = buildDefaultClearance(key)
  }
  return clearances
}

/* -------------------------------------------------------
   Overall status calculation
   A student is fully registered only when every required clearance
   is approved.  If any clearance is rejected the overall status
   reflects that immediately.
------------------------------------------------------- */
export function calculateOverallStatus(clearances) {
  if (!clearances) return 'In Progress'

  const statuses = CLEARANCE_KEYS.map((key) => clearances[key]?.status || 'Pending')

  if (statuses.some((s) => s === 'Rejected'))            return 'Rejected'
  if (statuses.some((s) => s === 'Correction Required')) return 'Correction Required'
  if (statuses.every((s) => s === 'Approved'))           return 'Fully Registered'
  return 'In Progress'
}

/* -------------------------------------------------------
   Application normalisation
   Older applications may not have clearance data yet, so we add
   default clearances safely rather than crashing.
------------------------------------------------------- */
export function normalizeApplication(application) {
  if (application.clearances) {
    // Application already has clearances — just make sure overallStatus is in sync
    return {
      ...application,
      overallStatus: calculateOverallStatus(application.clearances),
    }
  }

  // First time this application is seen by the new workflow — add defaults
  const clearances = getDefaultClearances()
  return {
    ...application,
    clearances,
    overallStatus: 'In Progress',
  }
}

/* -------------------------------------------------------
   localStorage helpers — shared key and read/write logic
------------------------------------------------------- */
export const STORAGE_KEY = 'studentRegistrationApplications'

export function loadApplications() {
  try {
    // Also migrate data from the old key ('registrations') if needed
    const legacy = JSON.parse(localStorage.getItem('registrations') || '[]')
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')

    if (legacy.length > 0 && current.length === 0) {
      // Migrate legacy submissions to the new key with clearance data added
      const migrated = legacy.map(normalizeApplication)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      localStorage.removeItem('registrations')
      return migrated
    }

    return current.map(normalizeApplication)
  } catch {
    return []
  }
}

export function saveApplications(applications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
  } catch {
    // localStorage unavailable — silently ignore in this prototype
  }
}
