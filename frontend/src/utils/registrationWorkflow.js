/*
  registrationWorkflow.js
  -----------------------
  Shared helpers for mapping an official's office role to the one
  clearance they own, plus the login-identifier format checks used by
  Login.jsx. The backend is the source of truth for all workflow data —
  this file only holds small, static lookups the frontend still needs.
*/

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

// Role-to-clearance mapping — mirrors the physical registration card:
// each station (office role) stamps only its own section.
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

export const getAllowedClearanceKey = getAllowedClearanceForRole

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
