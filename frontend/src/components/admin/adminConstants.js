/* -------------------------------------------------------
   adminConstants.js
   -----------------------
   Fixed enum options used by the Admin Workspace's forms and filters.
   These are not "hardcoded data" — they mirror role/status enums the
   backend already defines (roles.role_key / role_scope='official',
   users.is_active, students.classification/residency_type). The same
   seven office role_keys already appear in backendLabels.js
   (ROLE_KEY_TO_CLEARANCE_KEY) and navbarHelpers.js (OFFICE_SHORT_LABELS)
   for the same reason: they're a fixed schema-defined list, not values
   chosen by the frontend.
------------------------------------------------------- */

// The seven office roles an Official account can be assigned to. value =
// the backend's canonical OfficeKey enum (app/core/enums.py) — sent as-is
// in office filters, primary_office on creation, and the office
// reassignment body. label = roles.role_name as shown elsewhere in the app.
export const OFFICE_ROLE_OPTIONS = [
  { value: 'REGISTRAR',        label: 'Registrar' },
  { value: 'HEALTH_SERVICES',  label: 'Health Services' },
  { value: 'SUCCESS_CENTER',   label: 'Success Center' },
  { value: 'FINANCIAL_AID',    label: 'Financial Aid' },
  { value: 'BUSINESS_OFFICE',  label: 'Business Office' },
  { value: 'RESIDENCE_LIFE',   label: 'Residence Life' },
  { value: 'PUBLIC_SAFETY',    label: 'Public Safety' },
]

export function officeLabel(roleKey) {
  return OFFICE_ROLE_OPTIONS.find((o) => o.value === roleKey)?.label || roleKey || '—'
}

// students.classification is free text in the schema (no CheckConstraint).
// Re-exported from the registration wizard's own list so admin-entered
// values match what students themselves submit, rather than defining a
// second, possibly-drifting list here.
export { CLASSIFICATION_OPTIONS } from '../registration/wizardConfig'

export const RESIDENCY_OPTIONS = [
  { value: 'residential', label: 'Residential (on campus)' },
  { value: 'commuter',    label: 'Commuter' },
]

export const ACCOUNT_STATUS_OPTIONS = [
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]
