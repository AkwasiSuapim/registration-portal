/* -------------------------------------------------------
   validators.js — one function per step, each returning an array of
   plain-English error strings. An empty array means the step may
   advance. Kept separate from the step components so RegistrationWizard
   can validate before switching steps without rendering anything.
------------------------------------------------------- */
import { MIN_CREDIT_HOURS, COURSE_OPTIONS } from './wizardConfig'

// A slot counts as uploaded either because a file was just selected and
// confirmed by the server in this session (slot.file present, status
// 'uploaded'), or because it was already on file when a draft was
// resumed — registrationAdapter.js's hydrateUploadSlotsFromDocuments
// sets status 'uploaded' with file: null in that case (there is no
// local File object to re-attach, only the backend's record of it), so
// checking slot.file alone would wrongly block a student who already
// uploaded this document in an earlier session from advancing.
function isUploaded(slot) {
  if (!slot) return false
  if (slot.status === 'uploaded') return true
  return Boolean(slot.file && slot.status !== 'error')
}

export function validateWelcomeDesk(state) {
  const errors = []
  const { identity, contact } = state
  if (!identity.fullName.trim()) errors.push('Legal full name is required.')
  if (!identity.studentId.trim()) errors.push('Student ID is required.')
  if (!identity.dateOfBirth.trim()) errors.push('Date of birth is required.')
  if (!contact.email.trim()) errors.push('College email is required.')
  if (!contact.phone.trim()) errors.push('Mobile phone is required.')
  if (!contact.address.trim()) errors.push('Mailing address is required.')
  if (!contact.city.trim()) errors.push('City is required.')
  if (!contact.state.trim()) errors.push('State is required.')
  if (!contact.zipCode.trim()) errors.push('ZIP code is required.')
  if (!isUploaded(state.photoIdUpload)) errors.push('Please upload a Photo ID.')
  return errors
}

export function validateHealthServices(state) {
  const errors = []
  const { emergency } = state
  if (!emergency.name.trim()) errors.push('Emergency contact name is required.')
  if (!emergency.relationship.trim()) errors.push('Emergency contact relationship is required.')
  if (!emergency.phone.trim()) errors.push('Emergency contact phone is required.')
  if (!isUploaded(state.immunizationUpload)) errors.push('Please upload your Immunization form.')
  if (!isUploaded(state.healthCardUpload)) errors.push('Please upload your Health or Hospital card.')
  return errors
}

export function validateSuccessCenter(state) {
  const errors = []
  const { academic, selectedCourseIds } = state
  if (!academic.major.trim()) errors.push('Major is required.')
  if (!academic.classification.trim()) errors.push('Classification is required.')
  if (selectedCourseIds.length === 0) {
    errors.push('Please select at least one course.')
  } else {
    const totalCreditHours = COURSE_OPTIONS
      .filter((course) => selectedCourseIds.includes(course.id))
      .reduce((total, course) => total + course.credits, 0)
    if (totalCreditHours < MIN_CREDIT_HOURS) {
      errors.push(`You must select at least ${MIN_CREDIT_HOURS} credit hours before continuing.`)
    }
  }
  // Transcript is optional for every student and never blocks submission.
  return errors
}

export function validateFinancialAid() {
  // Read-only step — nothing for the student to fill in here.
  return []
}

export function validateBusinessOffice(state) {
  const errors = []
  const { businessOffice } = state
  if (!businessOffice.isPresidentialScholar) {
    errors.push('Please tell us whether you are a Presidential Scholar.')
    return errors
  }
  if (businessOffice.isPresidentialScholar === 'yes') {
    if (!businessOffice.scholarSignatureName.trim()) {
      errors.push('Please sign by entering your full legal name.')
    }
  } else if (!isUploaded(businessOffice.paymentProofUpload)) {
    errors.push('Please upload an approved payment plan or proof of payment.')
  }
  return errors
}

export function validateResidenceLife(state) {
  const errors = []
  const { residenceLife } = state
  if (!residenceLife.housingStatus) {
    errors.push('Please select your housing status.')
    return errors
  }
  if (residenceLife.housingStatus === 'on-campus') {
    if (!residenceLife.hall) errors.push('Please select a residence hall.')
    if (!isUploaded(residenceLife.feeReceiptUpload)) {
      errors.push('Please upload your housing-fee receipt.')
    }
  }
  return errors
}

export function validateReview(state) {
  const errors = []
  if (!state.confirmed) {
    errors.push('Please check the confirmation box to confirm your information is accurate.')
  }
  return errors
}

export const STEP_VALIDATORS = [
  validateWelcomeDesk,
  validateHealthServices,
  validateSuccessCenter,
  validateFinancialAid,
  validateBusinessOffice,
  validateResidenceLife,
  validateReview,
]
