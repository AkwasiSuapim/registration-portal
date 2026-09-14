import { useEffect, useState } from 'react'
import { getApplicationDocuments } from '../../services/api'
import './registrationWizard.css'
import { useRegistrationDraft } from './useRegistrationDraft'
import { submitRegistration } from './registrationAdapter'
import { STEP_VALIDATORS } from './validators'
import { WIZARD_STEPS, createInitialWizardState, reviveWizardState } from './wizardConfig'
import StepIndicator from './StepIndicator'
import SubmissionModal from './SubmissionModal'
import WelcomeDeskStep from './steps/WelcomeDeskStep'
import HealthServicesStep from './steps/HealthServicesStep'
import SuccessCenterStep from './steps/SuccessCenterStep'
import FinancialAidStep from './steps/FinancialAidStep'
import BusinessOfficeStep from './steps/BusinessOfficeStep'
import ResidenceLifeStep from './steps/ResidenceLifeStep'
import ReviewStep from './steps/ReviewStep'

const STEP_HELP = [
  'Confirm who you are and how the college can reach you.',
  'Tell Health Services how to reach you in an emergency and share your records.',
  'Choose your major, classification, and courses for the term.',
  'Review your financial aid document — no action needed here.',
  'Answer one question about scholarship status and your payment method.',
  'Tell Residence Life your housing plans for the term.',
  'Check every answer before you submit — you can jump back to fix anything.',
]

function setUploadSlot(state, path, slot) {
  if (!path.includes('.')) return { ...state, [path]: slot }
  const [sectionKey, slotKey] = path.split('.')
  return { ...state, [sectionKey]: { ...state[sectionKey], [slotKey]: slot } }
}

function buildUploadSlot(file, error) {
  if (!file) return error ? { file: null, name: null, size: null, status: 'error', error } : null
  return { file, name: file.name, size: file.size, status: 'selected', error: null }
}

// RegistrationWizard — the seven-step Student Workspace registration
// flow. State is lifted to one object (see wizardConfig.createInitialWizardState)
// and persisted per-tab via useRegistrationDraft while the student is
// still filling the form out; nothing reaches the server until the
// final submit (see registrationAdapter.js for exactly what is sent).
function RegistrationWizard({ currentSession, applications, onRegistrationSubmitted, onSwitchTab }) {
  const draftKey = currentSession?.id || currentSession?.email || 'student'
  const [state, setState, clearDraft] = useRegistrationDraft(
    draftKey,
    () => createInitialWizardState(currentSession?.email || ''),
    reviveWizardState
  )

  const [stepIndex, setStepIndex] = useState(0)
  const [stepErrors, setStepErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submissionResult, setSubmissionResult] = useState(null) // { applicationNumber, documentFailureCount }

  const [financialAid, setFinancialAid] = useState({ loading: true, document: null, error: '' })

  // The most recently submitted application (if any) is the only place
  // an existing financial_aid_form document could already live — a
  // brand-new registration has no application yet, so this step shows
  // the placeholder until Financial Aid uploads one on a real application.
  const mostRecentApplicationId = applications?.[0]?.id || null

  useEffect(() => {
    let cancelled = false

    async function loadFinancialAidDocument() {
      if (!mostRecentApplicationId) {
        if (!cancelled) setFinancialAid({ loading: false, document: null, error: '' })
        return
      }
      try {
        const docs = await getApplicationDocuments(mostRecentApplicationId)
        if (cancelled) return
        const doc = docs.find((d) => d.document_type === 'financial_aid_form') || null
        setFinancialAid({ loading: false, document: doc, error: '' })
      } catch (err) {
        if (!cancelled) setFinancialAid({ loading: false, document: null, error: err.message || 'request failed' })
      }
    }

    loadFinancialAidDocument()
    return () => { cancelled = true }
  }, [mostRecentApplicationId])

  const updateSection = (sectionKey, partial) => {
    setState((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], ...partial } }))
  }

  const updateSelectedCourses = (ids) => {
    setState((prev) => ({ ...prev, selectedCourseIds: ids }))
  }

  const updateUploadSlot = (path, file, error) => {
    setState((prev) => setUploadSlot(prev, path, buildUploadSlot(file, error)))
  }

  const goToStep = (index) => {
    setStepIndex(index)
    setStepErrors([])
    setSubmitError('')
  }

  const handleBack = () => {
    if (stepIndex === 0) return
    goToStep(stepIndex - 1)
  }

  const handleUploadStatus = (slotKey, status, extra) => {
    setState((prev) => {
      const applyToSlot = (slot) => slot ? { ...slot, status, error: extra?.error || null, documentId: extra?.documentId ?? slot.documentId } : slot
      if (slotKey.includes('.')) {
        const [sectionKey, slotName] = slotKey.split('.')
        return { ...prev, [sectionKey]: { ...prev[sectionKey], [slotName]: applyToSlot(prev[sectionKey][slotName]) } }
      }
      return { ...prev, [slotKey]: applyToSlot(prev[slotKey]) }
    })
  }

  const handleContinue = async (event) => {
    event.preventDefault()
    const errors = STEP_VALIDATORS[stepIndex](state)
    if (errors.length > 0) {
      setStepErrors(errors)
      return
    }
    setStepErrors([])

    const isLastStep = stepIndex === WIZARD_STEPS.length - 1
    if (!isLastStep) {
      goToStep(stepIndex + 1)
      return
    }

    // Final step — create the application, then attach every staged
    // document. Guarded by `submitting` so a double-click cannot fire
    // two POST /applications requests for the same registration.
    if (submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const { application, failures } = await submitRegistration(state, { onUploadStatus: handleUploadStatus })
      setSubmissionResult({ applicationNumber: application.application_number, documentFailureCount: failures.length })
      clearDraft()
      onRegistrationSubmitted?.(application)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong while submitting your registration.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturnToDashboard = () => {
    setSubmissionResult(null)
    onSwitchTab?.('overview')
  }

  const stepProps = { state, updateSection, updateSelectedCourses, updateUploadSlot }

  let StepComponent
  switch (WIZARD_STEPS[stepIndex].key) {
    case 'welcome-desk':    StepComponent = <WelcomeDeskStep {...stepProps} />; break
    case 'health-services': StepComponent = <HealthServicesStep {...stepProps} />; break
    case 'success-center':  StepComponent = <SuccessCenterStep {...stepProps} />; break
    case 'financial-aid':
      StepComponent = <FinancialAidStep document={financialAid.document} loading={financialAid.loading} error={financialAid.error} />
      break
    case 'business-office': StepComponent = <BusinessOfficeStep {...stepProps} />; break
    case 'residence-life':  StepComponent = <ResidenceLifeStep {...stepProps} />; break
    case 'review':
    default:
      StepComponent = (
        <ReviewStep
          state={state}
          onEditStep={goToStep}
          onToggleConfirmed={(checked) => setState((prev) => ({ ...prev, confirmed: checked }))}
        />
      )
  }

  if (submissionResult) {
    return (
      <SubmissionModal
        applicationNumber={submissionResult.applicationNumber}
        documentFailureCount={submissionResult.documentFailureCount}
        onReturnToDashboard={handleReturnToDashboard}
      />
    )
  }

  const isLastStep = stepIndex === WIZARD_STEPS.length - 1
  const currentStepMeta = WIZARD_STEPS[stepIndex]

  return (
    <div className="reg-wizard">
      <StepIndicator steps={WIZARD_STEPS} currentIndex={stepIndex} />

      <form className="reg-step" onSubmit={handleContinue} noValidate aria-labelledby="reg-step-title">
        <header className="reg-step__header">
          {currentStepMeta.office && <p className="reg-step__eyebrow">{currentStepMeta.office}</p>}
          <h2 className="reg-step__title" id="reg-step-title">{currentStepMeta.label}</h2>
          <p className="reg-step__help">{STEP_HELP[stepIndex]}</p>
        </header>

        {stepErrors.length > 0 && (
          <div className="reg-validation" role="alert">
            <p className="reg-validation__heading">Please fix the following before continuing:</p>
            <ul className="reg-validation__list">
              {stepErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}

        {submitError && <p className="reg-warning" role="alert">{submitError}</p>}

        <div className="reg-step__body">{StepComponent}</div>

        <div className="reg-step__nav">
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleBack}
            disabled={stepIndex === 0 || submitting}
          >
            Back
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Submitting…' : isLastStep ? 'Submit Registration' : 'Save & Continue'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RegistrationWizard
