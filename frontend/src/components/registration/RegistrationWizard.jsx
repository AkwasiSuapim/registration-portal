import { useEffect, useState } from 'react'
import { getApplicationDocuments } from '../../services/api'
import {
  getCurrentRegistration, startRegistration, saveRegistrationSection, submitRegistration,
  getRegistrationDocuments, uploadRegistrationDocument, isNoDraftError,
} from '../../services/registrationApi'
import './registrationWizard.css'
import { useRegistrationDraft } from './useRegistrationDraft'
import {
  buildSectionPayload, hydrateStateFromRegistration, hydrateUploadSlotsFromDocuments, SLOT_DOCUMENT_TYPES,
} from './registrationAdapter'
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

function countErroredUploads(state) {
  const slots = [
    state.photoIdUpload, state.immunizationUpload, state.healthCardUpload, state.transcriptUpload,
    state.businessOffice.paymentProofUpload, state.residenceLife.feeReceiptUpload,
  ]
  return slots.filter((slot) => slot?.status === 'error').length
}

// Backend errors arrive either as a plain message (err.message) or, for
// grouped validation failures (POST .../submit with missing required
// fields, or a rejected courses[] payload), as an array under
// err.detail.detail — each item shaped like Pydantic's own {msg, ...}.
// Always returns an array so the caller can render it through the same
// reg-validation list STEP_VALIDATORS already uses, instead of a second
// error UI.
function extractBackendErrorList(err) {
  const detail = err?.detail?.detail
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail.map((item) => item?.msg).filter(Boolean)
    if (messages.length > 0) return messages
  }
  return [err?.message || 'Something went wrong. Please try again.']
}

// RegistrationWizard — the seven-step Student Workspace registration
// flow, backed by the draft-based /registrations/* API (PHASE C):
//   - On mount: GET /registrations/current, or POST /registrations if
//     the student has no draft yet (idempotent server-side, so a
//     refresh/double-click never creates a duplicate).
//   - Save & Continue: PATCH /registrations/{id}/sections/{section} for
//     the step just completed, before advancing.
//   - File uploads: POST /registrations/{id}/documents as soon as a
//     file is selected, inside whichever step owns it — never a
//     separate "Upload Documents" step.
//   - Submit (the Review step's button): POST /registrations/{id}/submit.
// Public Safety is never one of these steps — see SubmissionModal for
// how the backend's public_safety_instruction is shown after submit.
function RegistrationWizard({ currentSession, applications, onRegistrationSubmitted, onSwitchTab }) {
  const draftKey = currentSession?.id || currentSession?.email || 'student'
  const [state, setState, clearDraft] = useRegistrationDraft(
    draftKey,
    () => createInitialWizardState(currentSession?.email || ''),
    reviveWizardState
  )

  // 'loading' while GET /registrations/current (+ a fallback POST, +
  // fetching already-uploaded documents) resolves; 'ready' once
  // applicationId is known and the wizard can actually save anything.
  const [wizardStatus, setWizardStatus] = useState('loading')
  const [mountError, setMountError] = useState('')
  const [applicationId, setApplicationId] = useState(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [stepErrors, setStepErrors] = useState([])
  const [sectionSaving, setSectionSaving] = useState(false)
  const [sectionSaveErrors, setSectionSaveErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitErrors, setSubmitErrors] = useState([])
  const [submissionResult, setSubmissionResult] = useState(null) // { applicationNumber, publicSafetyInstruction, documentFailureCount }

  const [financialAid, setFinancialAid] = useState({ loading: true, document: null, error: '' })

  // The most recently submitted application (if any) is the only place
  // an existing financial_aid_form document could already live — a
  // brand-new registration has no application yet, so this step shows
  // the placeholder until Financial Aid uploads one on a real application.
  const mostRecentApplicationId = applications?.[0]?.id || null

  // reloadToken has no meaning beyond "changed" — kept for symmetry with
  // the rest of the app's retry pattern, though this wizard only ever
  // needs to retry the mount sequence once (see the Try Again button).
  const [mountReloadToken, setMountReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setWizardStatus('loading')
      setMountError('')
      try {
        let registration
        try {
          registration = await getCurrentRegistration()
        } catch (err) {
          if (!isNoDraftError(err)) throw err
          registration = await startRegistration()
        }
        if (cancelled) return
        setApplicationId(registration.id)
        setState((prev) => hydrateStateFromRegistration(prev, registration))

        try {
          const documents = await getRegistrationDocuments(registration.id)
          if (!cancelled) setState((prev) => hydrateUploadSlotsFromDocuments(prev, documents))
        } catch {
          // Non-fatal — upload slots just show as not-yet-uploaded;
          // the student can re-select a file if one was actually saved.
        }

        if (!cancelled) setWizardStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setMountError(err.message || 'Could not load your registration.')
          setWizardStatus('error')
        }
      }
    }
    run()
    return () => { cancelled = true }
    // setState's identity is stable (it's useRegistrationDraft's own
    // useState setter, just returned through that hook) — included
    // anyway so this satisfies exhaustive-deps without a disable comment.
  }, [mountReloadToken, setState])

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

  // A file is uploaded to the backend the moment it's selected — the
  // wizard is always backed by a real applicationId by the time any
  // step is interactive (wizardStatus === 'ready'), so there's no
  // longer a reason to defer uploads to submission time.
  const updateUploadSlot = async (path, file, error) => {
    setState((prev) => setUploadSlot(prev, path, buildUploadSlot(file, error)))
    if (!file || error || !applicationId) return

    const documentType = SLOT_DOCUMENT_TYPES[path]
    if (!documentType) return

    handleUploadStatus(path, 'uploading')
    try {
      const result = await uploadRegistrationDocument(applicationId, documentType, file)
      handleUploadStatus(path, 'uploaded', { documentId: result.document.id })
    } catch (err) {
      handleUploadStatus(path, 'error', { error: err.message || 'Could not upload this document.' })
    }
  }

  const goToStep = (index) => {
    setStepIndex(index)
    setStepErrors([])
    setSectionSaveErrors([])
    setSubmitErrors([])
  }

  const handleBack = () => {
    if (stepIndex === 0) return
    goToStep(stepIndex - 1)
  }

  const handleContinue = async (event) => {
    event.preventDefault()
    const errors = STEP_VALIDATORS[stepIndex](state)
    if (errors.length > 0) {
      setStepErrors(errors)
      return
    }
    setStepErrors([])
    setSectionSaveErrors([])

    if (sectionSaving || submitting) return

    const currentStepMeta = WIZARD_STEPS[stepIndex]
    const isLastStep = stepIndex === WIZARD_STEPS.length - 1

    if (!isLastStep) {
      setSectionSaving(true)
      try {
        const payload = buildSectionPayload(currentStepMeta.sectionKey, state)
        const updated = await saveRegistrationSection(applicationId, currentStepMeta.sectionKey, payload)
        // The backend is the source of truth for what actually got
        // saved (e.g. it derives academic_year from term_code) — fold
        // its response back into local state rather than assuming the
        // payload we sent is exactly what's now persisted.
        setState((prev) => hydrateStateFromRegistration(prev, updated))
        goToStep(stepIndex + 1)
      } catch (err) {
        setSectionSaveErrors(extractBackendErrorList(err))
      } finally {
        setSectionSaving(false)
      }
      return
    }

    // Review step — save its own section (the confirmation checkbox),
    // then submit. Guarded by `submitting` so a double-click can't fire
    // two submissions for the same registration; the backend's own
    // "already submitted" 409 is a second line of defense.
    setSubmitting(true)
    setSubmitErrors([])
    try {
      await saveRegistrationSection(applicationId, currentStepMeta.sectionKey, buildSectionPayload(currentStepMeta.sectionKey, state))
      const result = await submitRegistration(applicationId)
      setSubmissionResult({
        applicationNumber: result.application.application_number,
        publicSafetyInstruction: result.public_safety_instruction,
        documentFailureCount: countErroredUploads(state),
      })
      clearDraft()
      onRegistrationSubmitted?.(result.application)
    } catch (err) {
      setSubmitErrors(extractBackendErrorList(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturnToDashboard = () => {
    setSubmissionResult(null)
    onSwitchTab?.('overview')
  }

  const stepProps = { state, updateSection, updateSelectedCourses, updateUploadSlot }

  if (wizardStatus === 'loading') {
    return (
      <div className="workspace-skeleton" aria-busy="true" aria-live="polite">
        <p className="workspace-skeleton__label">
          <span className="workspace-spinner" aria-hidden="true"></span>
          Loading your registration…
        </p>
        <div className="workspace-skeleton__block workspace-skeleton__block--tall"></div>
      </div>
    )
  }

  if (wizardStatus === 'error') {
    return (
      <div className="workspace-error" role="alert">
        <span className="workspace-error__icon" aria-hidden="true">!</span>
        <div className="workspace-error__body">
          <span className="workspace-error__title">We could not load your registration</span>
          <p className="workspace-error__text">{mountError}</p>
          <div className="workspace-error__actions">
            <button type="button" className="btn btn--outline" onClick={() => setMountReloadToken((t) => t + 1)}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (submissionResult) {
    return (
      <SubmissionModal
        applicationNumber={submissionResult.applicationNumber}
        publicSafetyInstruction={submissionResult.publicSafetyInstruction}
        documentFailureCount={submissionResult.documentFailureCount}
        onReturnToDashboard={handleReturnToDashboard}
      />
    )
  }

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

  const isLastStep = stepIndex === WIZARD_STEPS.length - 1
  const currentStepMeta = WIZARD_STEPS[stepIndex]
  const busy = sectionSaving || submitting
  const errorsToShow = stepErrors.length > 0 ? stepErrors : (isLastStep ? submitErrors : sectionSaveErrors)

  return (
    <div className="reg-wizard">
      <StepIndicator steps={WIZARD_STEPS} currentIndex={stepIndex} />

      <form className="reg-step" onSubmit={handleContinue} noValidate aria-labelledby="reg-step-title">
        <header className="reg-step__header">
          {currentStepMeta.office && <p className="reg-step__eyebrow">{currentStepMeta.office}</p>}
          <h2 className="reg-step__title" id="reg-step-title">{currentStepMeta.label}</h2>
          <p className="reg-step__help">{STEP_HELP[stepIndex]}</p>
        </header>

        {errorsToShow.length > 0 && (
          <div className="reg-validation" role="alert">
            <p className="reg-validation__heading">Please fix the following before continuing:</p>
            <ul className="reg-validation__list">
              {errorsToShow.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}

        <div className="reg-step__body">{StepComponent}</div>

        <div className="reg-step__nav">
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleBack}
            disabled={stepIndex === 0 || busy}
          >
            Back
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {submitting ? 'Submitting…' : sectionSaving ? 'Saving…' : isLastStep ? 'Submit Registration' : 'Save & Continue'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RegistrationWizard
