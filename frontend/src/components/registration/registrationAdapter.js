/* -------------------------------------------------------
   registrationAdapter.js
   -----------------------
   Translates between the wizard's local state (one object, see
   wizardConfig.createInitialWizardState) and the backend's
   /registrations/{id}/sections/{section} payload shape (see backend's
   app/services/registration_service.py save_section):

     buildSectionPayload(sectionKey, state)
       -> the JSON body to PATCH for one section.

     hydrateStateFromRegistration(initial, registration)
       -> wizard state with every field the backend already has data for
          filled in from a RegistrationResponse (GET /registrations/current,
          or the body POST /registrations returns for a brand-new draft).
          Only overwrites fields the backend actually has a value for, so
          a fresh empty draft leaves `initial` untouched.

     hydrateUploadSlotsFromDocuments(state, documents)
       -> upload slots marked 'uploaded' for any already-uploaded document
          whose document_type unambiguously belongs to one slot.

   The wizard still collects some fields with no backend column at all
   (health details beyond emergency contact, room number, e-signature,
   etc.) — those are sent anyway and stored as opaque JSON in
   Application.section_data (see that column's own docstring), so they
   round-trip correctly across a refresh/resume without ever being fake
   "processed" by the backend. See the final missing-API-support note
   for the couple of upload categories the backend has no dedicated
   document_type for.
------------------------------------------------------- */
import { COURSE_OPTIONS, DOCUMENT_TYPES, SLOT_DOCUMENT_TYPES } from './wizardConfig'

// document_type values that map to exactly one upload slot — safe to
// auto-fill as 'uploaded' when resuming a draft. "other" is shared by
// two slots (healthCardUpload, businessOffice.paymentProofUpload), so a
// resumed "other" document is left for the student to reconcile rather
// than guessed at — see wizardConfig.js's SLOT_DOCUMENT_TYPES comment.
const UNAMBIGUOUS_SLOT_BY_DOCUMENT_TYPE = Object.fromEntries(
  Object.entries(SLOT_DOCUMENT_TYPES).filter(
    ([, type], _i, all) => all.filter(([, t]) => t === type).length === 1
  ).map(([slotKey, type]) => [type, slotKey])
)

// Derives the backend "academic_year" (e.g. "2026-2027") from a term
// like "Fall 2026" or "Spring 2027".
export function deriveAcademicYear(registrationTerm) {
  const match = (registrationTerm || '').match(/(\d{4})/)
  if (!match) return ''
  const year = Number(match[1])
  return registrationTerm.startsWith('Fall') ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

/* -------------------------------------------------------
   State -> section payload
------------------------------------------------------- */
export function buildSectionPayload(sectionKey, state) {
  switch (sectionKey) {
    case 'welcome_desk':
      return { identity: state.identity, contact: state.contact }

    case 'health_services':
      return { health: state.health, emergency: state.emergency }

    case 'success_center': {
      const selectedCourses = COURSE_OPTIONS.filter((c) => state.selectedCourseIds.includes(c.id))
      return {
        // Structured fields the backend writes to real columns.
        major: state.academic.major,
        classification: state.academic.classification,
        term_code: state.academic.registrationTerm,
        academic_year: deriveAcademicYear(state.academic.registrationTerm),
        courses: selectedCourses.map((course) => ({
          course_code: course.code,
          course_title: course.title,
          section: null,
          credit_hours: course.credits,
        })),
        // No backend column — stored as opaque section_data.
        minor: state.academic.minor,
        academicAdvisor: state.academic.academicAdvisor,
      }
    }

    // Read-only step for the student — nothing to save, but every
    // Save & Continue still calls PATCH for consistency (see
    // RegistrationWizard.jsx).
    case 'financial_aid':
      return {}

    case 'business_office':
      return {
        isPresidentialScholar: state.businessOffice.isPresidentialScholar,
        scholarSignatureName: state.businessOffice.scholarSignatureName,
      }

    case 'residence_life':
      return {
        // Structured: drives Application.housing_required, which is
        // what actually gates the Residence Life / Public Safety
        // clearance chain server-side (see backend's workflow_service).
        housing_required: state.residenceLife.housingStatus === 'on-campus',
        // No backend column — stored as opaque section_data, but also
        // what hydrateStateFromRegistration reads back for the radio
        // choice itself (housing_required alone can't distinguish "not
        // yet answered" from a default).
        housingStatus: state.residenceLife.housingStatus,
        hall: state.residenceLife.hall,
        roomNumber: state.residenceLife.roomNumber,
      }

    case 'review':
      return { confirmed: state.confirmed }

    default:
      return {}
  }
}

/* -------------------------------------------------------
   Backend registration -> state
------------------------------------------------------- */
export function hydrateStateFromRegistration(initial, registration) {
  if (!registration) return initial
  const sectionData = registration.section_data || {}
  const next = { ...initial }

  const welcomeDesk = sectionData.welcome_desk || {}
  if (welcomeDesk.identity) next.identity = { ...next.identity, ...welcomeDesk.identity }
  if (welcomeDesk.contact) next.contact = { ...next.contact, ...welcomeDesk.contact }

  const healthServices = sectionData.health_services || {}
  if (healthServices.health) next.health = { ...next.health, ...healthServices.health }
  if (healthServices.emergency) next.emergency = { ...next.emergency, ...healthServices.emergency }

  const successCenter = sectionData.success_center || {}
  next.academic = {
    ...next.academic,
    ...(registration.term_code ? { registrationTerm: registration.term_code } : {}),
    ...(registration.major ? { major: registration.major } : {}),
    ...(registration.classification ? { classification: registration.classification } : {}),
    ...(successCenter.minor !== undefined ? { minor: successCenter.minor } : {}),
    ...(successCenter.academicAdvisor !== undefined ? { academicAdvisor: successCenter.academicAdvisor } : {}),
  }
  if (registration.courses?.length) {
    next.selectedCourseIds = registration.courses
      .map((saved) => COURSE_OPTIONS.find((c) => c.code === saved.course_code)?.id)
      .filter(Boolean)
  }

  const businessOffice = sectionData.business_office
  if (businessOffice) next.businessOffice = { ...next.businessOffice, ...businessOffice }

  const residenceLife = sectionData.residence_life
  if (residenceLife) next.residenceLife = { ...next.residenceLife, ...residenceLife }

  const review = sectionData.review
  if (review?.confirmed !== undefined) next.confirmed = review.confirmed

  return next
}

/* -------------------------------------------------------
   Already-uploaded documents -> upload slot state
------------------------------------------------------- */
export function hydrateUploadSlotsFromDocuments(state, documents) {
  if (!documents?.length) return state
  const next = { ...state }

  // Newest first is what the backend already returns; keep only the
  // latest document per type.
  const latestByType = {}
  for (const doc of documents) {
    if (!latestByType[doc.document_type]) latestByType[doc.document_type] = doc
  }

  const applySlot = (path, doc) => {
    const slot = { file: null, name: doc.original_filename, size: doc.size_bytes, status: 'uploaded', error: null, documentId: doc.id }
    if (!path.includes('.')) {
      next[path] = slot
      return
    }
    const [sectionKey, slotKey] = path.split('.')
    next[sectionKey] = { ...next[sectionKey], [slotKey]: slot }
  }

  for (const [documentType, slotKey] of Object.entries(UNAMBIGUOUS_SLOT_BY_DOCUMENT_TYPE)) {
    const doc = latestByType[documentType]
    if (doc) applySlot(slotKey, doc)
  }

  return next
}

// Every wizard slot's backend document_type — re-exported here (rather
// than importing wizardConfig directly in RegistrationWizard.jsx just
// for this) so the wizard has one place to look up "what category does
// this slot upload as" when a file is selected.
export { SLOT_DOCUMENT_TYPES, DOCUMENT_TYPES }
