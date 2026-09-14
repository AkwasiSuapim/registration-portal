/* -------------------------------------------------------
   registrationAdapter.js
   -----------------------
   Translates wizard state into the exact payloads the existing,
   unmodified backend contract expects:

     POST /applications                       (term_code, academic_year,
                                                 major, classification,
                                                 housing_required, courses)
     POST /applications/{id}/documents         (document_type, file)

   The wizard collects a lot more than those two endpoints accept —
   health information, emergency contact, presidential-scholar signature,
   residence hall / room number, and more all have no column or endpoint
   on the backend today. Those fields are intentionally NOT sent
   anywhere; they exist only in the browser for this session (see
   useRegistrationDraft.js) and are called out at the end of the feature
   summary as missing API support. This file never invents a fake
   success for anything the backend does not actually store.
------------------------------------------------------- */
import { createApplication, uploadDocument } from '../../services/api'
import { COURSE_OPTIONS, DOCUMENT_TYPES } from './wizardConfig'

// Derives the backend "academic_year" (e.g. "2026-2027") from a term
// like "Fall 2026" or "Spring 2027" — same rule the existing StudentForm
// uses, kept in sync so both flows produce identical payload shapes.
export function deriveAcademicYear(registrationTerm) {
  const match = (registrationTerm || '').match(/(\d{4})/)
  if (!match) return ''
  const year = Number(match[1])
  return registrationTerm.startsWith('Fall') ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

export function buildApplicationPayload(state) {
  const selectedCourses = COURSE_OPTIONS.filter((course) =>
    state.selectedCourseIds.includes(course.id)
  )
  return {
    term_code: state.academic.registrationTerm,
    academic_year: deriveAcademicYear(state.academic.registrationTerm),
    major: state.academic.major,
    classification: state.academic.classification,
    housing_required: state.residenceLife.housingStatus === 'on-campus',
    courses: selectedCourses.map((course) => ({
      course_code: course.code,
      course_title: course.title,
      section: null,
      credit_hours: course.credits,
    })),
  }
}

// Every upload slot that currently holds a locally-selected file (not yet
// confirmed on the server) becomes one POST /applications/{id}/documents
// call once the application exists. `slotKey` uses the same dotted-path
// convention as RegistrationWizard's updateUploadSlot/handleUploadStatus
// ("section.field" for nested slots) so the wizard can update the right
// slot's status as each upload settles.
export function collectPendingUploads(state) {
  const uploads = []
  const addIfPending = (slotKey, slot, documentType) => {
    if (slot && slot.file && slot.status !== 'uploaded') {
      uploads.push({ slotKey, file: slot.file, documentType })
    }
  }

  addIfPending('photoIdUpload', state.photoIdUpload, DOCUMENT_TYPES.PHOTO_ID)
  addIfPending('immunizationUpload', state.immunizationUpload, DOCUMENT_TYPES.IMMUNIZATION)
  // No dedicated backend category for a hospital/health card — filed as
  // "other" (see final missing-API-support note).
  addIfPending('healthCardUpload', state.healthCardUpload, DOCUMENT_TYPES.OTHER)
  addIfPending('transcriptUpload', state.transcriptUpload, DOCUMENT_TYPES.TRANSCRIPT)
  // Scholarship agreement is provided by the Business Office, not
  // uploaded by the student, so it is never included here even when the
  // student answered "Presidential Scholar: Yes".
  // No dedicated backend category for a payment plan / proof of payment —
  // filed as "other".
  addIfPending('businessOffice.paymentProofUpload', state.businessOffice.paymentProofUpload, DOCUMENT_TYPES.OTHER)
  // Housing fee receipts share the "housing_form" category with the
  // housing application itself — the backend has no separate receipt type.
  addIfPending('residenceLife.feeReceiptUpload', state.residenceLife.feeReceiptUpload, DOCUMENT_TYPES.HOUSING_FORM)

  return uploads
}

// Creates the application, then uploads every pending file one at a time.
// A document upload failure never rolls back the (already-created)
// application — the student can retry a failed attachment later from the
// workspace's existing Documents tab. onUploadStatus(slotKey, status, extra)
// lets the wizard reflect real server progress per upload slot.
export async function submitRegistration(state, { onUploadStatus } = {}) {
  const application = await createApplication(buildApplicationPayload(state))
  const pending = collectPendingUploads(state)
  const failures = []

  for (const upload of pending) {
    onUploadStatus?.(upload.slotKey, 'uploading')
    try {
      const result = await uploadDocument(application.id, upload.documentType, upload.file)
      onUploadStatus?.(upload.slotKey, 'uploaded', { documentId: result.document.id })
    } catch (err) {
      const message = err.message || 'Could not upload this document.'
      onUploadStatus?.(upload.slotKey, 'error', { error: message })
      failures.push({ slotKey: upload.slotKey, message })
    }
  }

  return { application, failures }
}
