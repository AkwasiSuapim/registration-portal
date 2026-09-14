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

// The seven office roles an Official account can be assigned to.
// value = roles.role_key, label = roles.role_name as shown elsewhere
// in the app.
export const OFFICE_ROLE_OPTIONS = [
  { value: 'registrar',        label: 'Registrar' },
  { value: 'health_services',  label: 'Health Services' },
  { value: 'success_center',   label: 'Success Center' },
  { value: 'financial_aid',    label: 'Financial Aid' },
  { value: 'business_office',  label: 'Business Office' },
  { value: 'residence_life',   label: 'Residence Life' },
  { value: 'public_safety',    label: 'Public Safety' },
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
