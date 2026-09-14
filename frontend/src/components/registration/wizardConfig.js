/* -------------------------------------------------------
   wizardConfig.js
   -----------------------
   Static configuration for the seven-step Student Workspace
   registration wizard: step metadata, field option lists, and the
   file-upload constraints mirrored from the backend so we can fail
   fast client-side (backend/app/services/document_service.py is the
   source of truth and still re-validates everything server-side).
------------------------------------------------------- */

// The exact document_type strings the backend accepts (document_service.py
// ALLOWED_DOCUMENT_TYPES). The wizard has more upload slots than the
// backend has categories, so a few slots share the closest type — noted
// on each slot below and called out in the final "missing API support" list.
export const DOCUMENT_TYPES = {
  PHOTO_ID: 'photo_id',
  IMMUNIZATION: 'immunization_record',
  FINANCIAL_AID_FORM: 'financial_aid_form',
  SCHOLARSHIP_AGREEMENT: 'scholarship_agreement',
  HOUSING_FORM: 'housing_form',
  TRANSCRIPT: 'transcript',
  OTHER: 'other',
}

// Mirrors document_service.ALLOWED_EXTENSIONS / MAX_UPLOAD_SIZE_MB so a
// student sees a validation message immediately instead of waiting on a
// round trip to the server.
export const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx']
export const MAX_UPLOAD_SIZE_MB = 10

export function validateFileSelection(file) {
  if (!file) return 'Please choose a file.'
  const name = file.name || ''
  const ext = name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : ''
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return `That file type is not supported. Allowed types: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`
  }
  if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    return `That file is too large. Maximum allowed size is ${MAX_UPLOAD_SIZE_MB} MB.`
  }
  return null
}

/* -------------------------------------------------------
   Step metadata — short labels for the step indicator, plus the
   office each step belongs to (shown on the Review step and used to
   group the confirmation summary by office).

   sectionKey is the backend's canonical section name (see backend's
   app/schemas/registration.py SECTION_KEYS) — every step key here maps
   1:1 to one just by swapping "-" for "_", but sectionKey is spelled
   out explicitly so that isn't a hidden assumption baked into the code
   that touches the API. Public Safety has no entry here on purpose —
   it is never an online wizard step (handled entirely in person; see
   the Public Safety instruction shown after submit).
------------------------------------------------------- */
export const WIZARD_STEPS = [
  { key: 'welcome-desk',     sectionKey: 'welcome_desk',    label: 'Welcome Desk',   office: 'Welcome Desk / Registrar' },
  { key: 'health-services',  sectionKey: 'health_services', label: 'Health Services', office: 'Health Services' },
  { key: 'success-center',   sectionKey: 'success_center',  label: 'Success Center',  office: 'Success Center' },
  { key: 'financial-aid',    sectionKey: 'financial_aid',   label: 'Financial Aid',   office: 'Financial Aid' },
  { key: 'business-office',  sectionKey: 'business_office', label: 'Business Office', office: 'Business Office / Cashier' },
  { key: 'residence-life',   sectionKey: 'residence_life',  label: 'Residence Life',  office: 'Residence Life' },
  { key: 'review',           sectionKey: 'review',          label: 'Review & Submit', office: null },
]

// Which document_type (backend/app/services/document_service.py
// ALLOWED_DOCUMENT_TYPES) each upload slot saves as, keyed the same way
// updateUploadSlot's path argument is ('section.field' for nested
// slots) — the single place that mapping lives, used both to upload a
// newly-selected file and to match an already-uploaded document back to
// its slot when a draft is resumed (see registrationAdapter.js).
export const SLOT_DOCUMENT_TYPES = {
  photoIdUpload: DOCUMENT_TYPES.PHOTO_ID,
  immunizationUpload: DOCUMENT_TYPES.IMMUNIZATION,
  // No dedicated backend category for a hospital/health card — filed as
  // "other" (see final missing-API-support note). Because several slots
  // share "other", an "other" document found on resume can't be
  // reliably matched back to one specific slot — see
  // registrationAdapter.js's hydrateUploadSlotsFromDocuments.
  healthCardUpload: DOCUMENT_TYPES.OTHER,
  transcriptUpload: DOCUMENT_TYPES.TRANSCRIPT,
  'businessOffice.paymentProofUpload': DOCUMENT_TYPES.OTHER,
  // Housing fee receipts share the "housing_form" category with the
  // housing application itself — the backend has no separate receipt type.
  'residenceLife.feeReceiptUpload': DOCUMENT_TYPES.HOUSING_FORM,
}

/* -------------------------------------------------------
   Option lists (kept local to the wizard rather than imported from
   StudentForm.jsx, which stays untouched — it powers the separate,
   pre-login /register intake page).
------------------------------------------------------- */
export const RELATIONSHIP_OPTIONS = ['Parent', 'Guardian', 'Sibling', 'Spouse', 'Other']

export const MAJOR_OPTIONS = ['Computer Science', 'Business Administration', 'Biology', 'Nursing', 'Education']
export const MINOR_OPTIONS = ['None', 'Data Analytics', 'Psychology', 'Spanish', 'Writing']
export const CLASSIFICATION_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Transfer Student']
export const TERM_OPTIONS = ['Fall 2026', 'Spring 2027', 'Summer 2027']

export const COURSE_OPTIONS = [
  { id: 'eng-101',  code: 'ENG 101',  title: 'College Writing I',          credits: 3, schedule: 'Mon/Wed 9:00 AM'  },
  { id: 'math-151', code: 'MATH 151', title: 'College Algebra',             credits: 3, schedule: 'Tue/Thu 10:30 AM' },
  { id: 'cs-130',   code: 'CS 130',   title: 'Introduction to Programming', credits: 4, schedule: 'Mon/Wed 1:00 PM'  },
  { id: 'bio-110',  code: 'BIO 110',  title: 'General Biology with Lab',    credits: 4, schedule: 'Tue/Thu 2:00 PM'  },
  { id: 'hist-210', code: 'HIST 210', title: 'Modern World History',        credits: 3, schedule: 'Fri 9:00 AM'      },
  { id: 'comm-120', code: 'COMM 120', title: 'Public Speaking',             credits: 3, schedule: 'Wed 4:00 PM'      },
]

// Matches backend/app/services/registration_service.py MIN_CREDIT_HOURS
// (and application_service.create_student_application's legacy check) —
// was out of sync with the backend (12 vs. the backend's real 15) before
// this wiring pass; fixed so client-side validation never lets a student
// reach Submit with a total the backend is guaranteed to reject.
export const MIN_CREDIT_HOURS = 15

export const HOUSING_STATUS_OPTIONS = [
  { value: 'on-campus', label: 'On-campus resident' },
  { value: 'commuter',  label: 'Commuter — living off campus' },
]

export const RESIDENCE_HALL_OPTIONS = ['Aggrey Hall', 'Dunbar Hall', 'Hood Hall', 'No preference']

/* -------------------------------------------------------
   Initial wizard state — one object for the whole form, saved to
   sessionStorage as the student moves between steps (see
   useRegistrationDraft.js). Upload slots share one shape:
   { file, name, size, status: 'selected'|'uploading'|'uploaded'|'error', error, documentId }
------------------------------------------------------- */
const TOP_LEVEL_UPLOAD_KEYS = ['photoIdUpload', 'immunizationUpload', 'healthCardUpload', 'transcriptUpload']
const NESTED_UPLOAD_PATHS = [
  ['businessOffice', 'paymentProofUpload'],
  ['residenceLife', 'feeReceiptUpload'],
]
const RELOAD_CLEARED_MESSAGE = 'This file was cleared when the page reloaded — please choose it again.'

// A File object cannot survive JSON storage (see useRegistrationDraft.js),
// so a slot restored from sessionStorage after a reload has metadata but
// no actual file to upload. Surface that honestly as an error state
// instead of silently treating it as still "selected".
export function reviveWizardState(state) {
  const fixSlot = (slot) => (slot && !slot.file ? { ...slot, status: 'error', error: RELOAD_CLEARED_MESSAGE } : slot)

  const next = { ...state }
  for (const key of TOP_LEVEL_UPLOAD_KEYS) {
    if (next[key]) next[key] = fixSlot(next[key])
  }
  for (const [sectionKey, slotKey] of NESTED_UPLOAD_PATHS) {
    if (next[sectionKey]?.[slotKey]) {
      next[sectionKey] = { ...next[sectionKey], [slotKey]: fixSlot(next[sectionKey][slotKey]) }
    }
  }
  return next
}

export function createInitialWizardState(prefillEmail = '') {
  return {
    identity: { fullName: '', preferredName: '', studentId: '', dateOfBirth: '' },
    contact: { email: prefillEmail, phone: '', address: '', city: '', state: '', zipCode: '' },
    photoIdUpload: null,

    health: {
      conditions: '', allergies: '', medications: '',
      physicianName: '', physicianPhone: '',
      insuranceProvider: '', insurancePolicyNumber: '',
    },
    emergency: { name: '', relationship: '', phone: '' },
    immunizationUpload: null,
    healthCardUpload: null,

    academic: { major: '', minor: '', classification: '', registrationTerm: TERM_OPTIONS[0], academicAdvisor: '' },
    selectedCourseIds: [],
    transcriptUpload: null,

    businessOffice: { isPresidentialScholar: '', scholarSignatureName: '', paymentProofUpload: null },

    residenceLife: { housingStatus: '', hall: '', roomNumber: '', feeReceiptUpload: null },

    confirmed: false,
  }
}
