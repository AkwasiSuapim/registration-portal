import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getMyApplications,
  getApplicationDocuments,
  getApplicationActivity,
  uploadDocument,
} from '../services/api'
import {
  formatOverallStatus,
  formatClearanceStatus,
  formatAvailability,
  DOCUMENT_TYPE_OPTIONS,
} from '../utils/backendLabels'
import StatusBadge from '../components/StatusBadge'
import DocumentList from '../components/DocumentList'
import ActivityTimeline from '../components/ActivityTimeline'
import WorkspaceNav from '../components/WorkspaceNav'
import RegistrationWizard from '../components/registration/RegistrationWizard'
import { STUDENT_PORTAL_PATH, STUDENT_REGISTRATION_PATH } from '../utils/routes'

/* -------------------------------------------------------
   Small formatting / derivation helpers
------------------------------------------------------- */
function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// The backend only gives us an account email (no display name field),
// so the friendly name shown in the greeting/avatar is derived from it
// — real account data, just presented a little more warmly.
function deriveDisplayName(email) {
  if (!email) return 'Student'
  const local = email.split('@')[0] || ''
  const word = local.split(/[._-]/)[0] || local
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : 'Student'
}

function greetingWord() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Short letter mark for an office, derived from its real label
// ("Financial Aid" -> "FA") — used as a lightweight icon substitute.
function officeInitials(label) {
  const letters = (label || '').match(/\b[A-Za-z]/g) || []
  return letters.slice(0, 2).join('').toUpperCase() || '—'
}

function clearanceNeedsAction(clearance) {
  return (
    clearance.status === 'correction_required' ||
    clearance.status === 'rejected' ||
    clearance.availability === 'needs_student_action'
  )
}

function clearanceIsDone(clearance) {
  return clearance.status === 'approved' || clearance.status === 'not_required'
}

// Public Safety / Student ID processing happens in person and is never
// one of the wizard's online steps — the Clearance Tracker shows a
// distinct label for it (rather than the generic pending/action wording)
// for as long as it is open, and Overview keeps a standing instruction
// visible until an authorized official completes it.
function isOpenPublicSafetyClearance(clearance) {
  return clearance.clearance_key === 'public_safety' && !clearanceIsDone(clearance)
}

function clearanceDisplayLabel(clearance) {
  if (isOpenPublicSafetyClearance(clearance)) return 'In-person action required'
  return formatClearanceStatus(clearance.status)
}

function computeProgress(application) {
  const clearances = application?.clearances || []
  const total = clearances.length
  const done = clearances.filter(clearanceIsDone).length
  const percent = total ? Math.round((done / total) * 100) : 0
  const actionClearance = clearances.find(clearanceNeedsAction) || null
  return { total, done, percent, actionClearance }
}

/* -------------------------------------------------------
   GuestNotice — shown when no student session is active
------------------------------------------------------- */
function GuestNotice({ onNavigate }) {
  return (
    <div className="portal-guest-notice">
      <svg className="portal-guest-notice__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
      <p className="portal-guest-notice__text">
        Please log in as a student to view your registration workspace.
      </p>
      <button type="button" className="btn btn--primary" onClick={() => onNavigate('/login')}>
        Go to Login
      </button>
    </div>
  )
}

/* -------------------------------------------------------
   LoadingSkeleton / ErrorState — top-level fetch states for
   GET /students/me/applications
------------------------------------------------------- */
function LoadingSkeleton() {
  return (
    <div className="workspace-skeleton" aria-busy="true" aria-live="polite">
      <p className="workspace-skeleton__label">
        <span className="workspace-spinner" aria-hidden="true"></span>
        Loading your registration status…
      </p>
      <div className="workspace-skeleton__block workspace-skeleton__block--tall"></div>
      <div className="workspace-skeleton__block workspace-skeleton__block--tall"></div>
      <div className="workspace-skeleton__row">
        <div className="workspace-skeleton__block"></div>
        <div className="workspace-skeleton__block"></div>
        <div className="workspace-skeleton__block"></div>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="workspace-error" role="alert">
      <span className="workspace-error__icon" aria-hidden="true">!</span>
      <div className="workspace-error__body">
        <span className="workspace-error__title">We could not load your registration status</span>
        <p className="workspace-error__text">{message}</p>
        <div className="workspace-error__actions">
          <button type="button" className="btn btn--outline" onClick={onRetry}>Try again</button>
          <a className="workspace-error__contact" href="mailto:registrar@livingstone.edu">Contact the Registrar</a>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   OverviewTab — greeting, progress, next action, office
   clearances, and past registration records
------------------------------------------------------- */
function OverviewTab({ applications, selectedApp, onSelectApp, onSwitchTab, onSelectClearance, displayName }) {
  const { total, done, percent, actionClearance } = computeProgress(selectedApp)

  const stages = selectedApp ? [
    {
      key: 'info', tag: 'Completed', title: 'Student Information',
      note: `Submitted ${formatDate(selectedApp.submitted_at)}.`, done: true,
    },
    {
      key: 'clearances',
      tag: selectedApp.overall_status === 'fully_registered' ? 'Completed' : 'Current stage',
      title: 'Campus Clearances',
      note: total
        ? `${done} of ${total} office clearances approved${actionClearance ? ` · ${actionClearance.clearance_label} needs you` : ''}.`
        : 'No offices to review yet.',
      done: selectedApp.overall_status === 'fully_registered',
    },
    {
      key: 'final',
      tag: selectedApp.overall_status === 'fully_registered' ? 'Completed' : 'Upcoming',
      title: 'Final Review',
      note: selectedApp.overall_status === 'fully_registered'
        ? 'The Registrar has confirmed your registration.'
        : 'The Registrar confirms once every clearance closes.',
      done: selectedApp.overall_status === 'fully_registered',
    },
  ] : []

  return (
    <div className="workspace-panel">

      <div className="workspace-hero">
        <div>
          <h1 className="workspace-hero__title">{greetingWord()}, {displayName}</h1>
          <p className="workspace-hero__subtitle">
            {selectedApp
              ? `Here is where your ${selectedApp.term_code} registration stands.`
              : 'You have not started a registration yet.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onSwitchTab(applications.length === 0 ? 'registration' : 'clearances')}
        >
          {applications.length === 0 ? 'Start Registration' : 'View Clearances'}
        </button>
      </div>

      {selectedApp && (
        <section className="workspace-card" aria-labelledby="ws-stage-h">
          <div className="workspace-card__head">
            <div>
              <h2 id="ws-stage-h" className="workspace-card__title">
                {selectedApp.term_code} registration progress
              </h2>
              <p className="workspace-card__subtitle">
                {done} of {total} office clearance{total === 1 ? '' : 's'} approved
              </p>
            </div>
            <div className="workspace-progress-number">
              <span className="workspace-progress-number__value">{percent}%</span>
              <span className="workspace-progress-number__label">complete</span>
            </div>
          </div>

          <div className="workspace-progress-bar" role="img" aria-label={`Registration ${percent} percent complete`}>
            <div className="workspace-progress-bar__fill" style={{ width: `${percent}%` }}></div>
          </div>

          <ol className="workspace-stages">
            {stages.map((stage) => (
              <li key={stage.key} className={`workspace-stage${stage.done ? ' workspace-stage--done' : ''}`}>
                <span className="workspace-stage__icon" aria-hidden="true">{stage.done ? '✓' : ''}</span>
                <div>
                  <span className="workspace-stage__tag">{stage.tag}</span>
                  <span className="workspace-stage__title">{stage.title}</span>
                  <span className="workspace-stage__note">{stage.note}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="workspace-card__actions">
            <button type="button" className="btn btn--primary" onClick={() => onSwitchTab('clearances')}>
              View clearances
            </button>
            <button type="button" className="btn btn--outline" onClick={() => onSwitchTab('documents')}>
              View documents
            </button>
          </div>
        </section>
      )}

      {actionClearance && (
        <section className="workspace-callout" aria-labelledby="ws-next-h">
          <span className="workspace-callout__icon" aria-hidden="true">!</span>
          <div className="workspace-callout__body">
            <span className="workspace-callout__eyebrow">Next action</span>
            <h2 id="ws-next-h" className="workspace-callout__title">
              Action required — {actionClearance.clearance_label}
            </h2>
            <p className="workspace-callout__text">
              {actionClearance.message || actionClearance.blocked_reason ||
                'This office needs a response from you before registration can move forward.'}
            </p>
            {actionClearance.reviewed_at && (
              <p className="workspace-callout__meta">Last updated {formatDate(actionClearance.reviewed_at)}</p>
            )}
          </div>
          <div className="workspace-callout__actions">
            <button
              type="button"
              className="btn btn--dark"
              onClick={() => { onSelectClearance(actionClearance.id); onSwitchTab('clearances') }}
            >
              View requirement
            </button>
            <button type="button" className="btn btn--outline" onClick={() => onSwitchTab('help')}>
              Contact office
            </button>
          </div>
        </section>
      )}

      {selectedApp && (() => {
        const publicSafety = (selectedApp.clearances || []).find((c) => c.clearance_key === 'public_safety')
        if (!publicSafety || clearanceIsDone(publicSafety)) return null
        return (
          <section className="workspace-callout workspace-callout--info" aria-labelledby="ws-ps-h">
            <span className="workspace-callout__icon" aria-hidden="true">i</span>
            <div className="workspace-callout__body">
              <span className="workspace-callout__eyebrow">Public Safety · In-person action required</span>
              <h2 id="ws-ps-h" className="workspace-callout__title">Visit the Public Safety Office for your Student ID</h2>
              <p className="workspace-callout__text">
                This step is completed in person and is not part of the online registration form.
                Bring a valid photo ID to Public Safety — your Clearance Tracker will update once an
                authorized official completes it there.
              </p>
            </div>
          </section>
        )
      })()}

      {selectedApp && (
        <section className="workspace-card workspace-card--flush" aria-labelledby="ws-off-h">
          <div className="workspace-card__head workspace-card__head--bordered">
            <div>
              <h2 id="ws-off-h" className="workspace-card__title">Office clearances</h2>
              <p className="workspace-card__subtitle">
                {total} participating office{total === 1 ? '' : 's'} · {selectedApp.term_code}
              </p>
            </div>
            <button type="button" className="btn btn--outline btn--small" onClick={() => onSwitchTab('clearances')}>
              View all clearances
            </button>
          </div>
          <ul className="workspace-office-list">
            {(selectedApp.clearances || []).map((clearance) => (
              <li key={clearance.id} className="workspace-office-row">
                <span className="workspace-office-row__icon" aria-hidden="true">{officeInitials(clearance.clearance_label)}</span>
                <span className="workspace-office-row__name">{clearance.clearance_label}</span>
                <span className="workspace-office-row__meta">{formatAvailability(clearance.availability)}</span>
                <StatusBadge status={clearanceDisplayLabel(clearance)} />
                <button
                  type="button"
                  className="btn btn--outline btn--small"
                  onClick={() => { onSelectClearance(clearance.id); onSwitchTab('clearances') }}
                >
                  View details
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="workspace-card" aria-labelledby="ws-rec-h">
        <div>
          <h2 id="ws-rec-h" className="workspace-card__title">Registration Records</h2>
          <p className="workspace-card__subtitle">
            Select a semester to review what you submitted and how each office responded.
          </p>
        </div>

        {applications.length > 0 ? (
          <div className="workspace-records">
            <div role="tablist" aria-label="Semesters" className="workspace-semesters">
              {applications.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedApp?.id === app.id}
                  className={`workspace-semester${selectedApp?.id === app.id ? ' workspace-semester--active' : ''}`}
                  onClick={() => onSelectApp(app.id)}
                >
                  <span className="workspace-semester__term">{app.term_code}</span>
                  <span className="workspace-semester__tag">{formatOverallStatus(app.overall_status)}</span>
                </button>
              ))}
            </div>

            {selectedApp && (
              <div role="tabpanel" className="workspace-record-panel">
                <div className="workspace-record-panel__head">
                  <div>
                    <h3 className="workspace-record-panel__title">{selectedApp.term_code} registration</h3>
                    <p className="workspace-record-panel__meta">
                      Application {selectedApp.application_number} · Submitted {formatDate(selectedApp.submitted_at)}
                    </p>
                  </div>
                  <StatusBadge status={formatOverallStatus(selectedApp.overall_status)} />
                </div>

                <div className="workspace-info-grid">
                  <div className="workspace-info-cell">
                    <span className="workspace-info-cell__label">Classification</span>
                    <span className="workspace-info-cell__value">{selectedApp.classification || '—'}</span>
                  </div>
                  <div className="workspace-info-cell">
                    <span className="workspace-info-cell__label">Major</span>
                    <span className="workspace-info-cell__value">{selectedApp.major || '—'}</span>
                  </div>
                  <div className="workspace-info-cell">
                    <span className="workspace-info-cell__label">Credit hours</span>
                    <span className="workspace-info-cell__value">{selectedApp.total_credit_hours ?? '—'}</span>
                  </div>
                  <div className="workspace-info-cell">
                    <span className="workspace-info-cell__label">Housing</span>
                    <span className="workspace-info-cell__value">{selectedApp.housing_required ? 'On-campus' : 'Not required'}</span>
                  </div>
                </div>

                <div className="workspace-record-panel__links">
                  <button type="button" className="btn btn--outline btn--small" onClick={() => onSwitchTab('documents')}>
                    View documents
                  </button>
                  <button type="button" className="btn btn--outline btn--small" onClick={() => onSwitchTab('activity')}>
                    View activity
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="workspace-empty">
            <span className="workspace-empty__icon" aria-hidden="true"></span>
            <h3 className="workspace-empty__title">No previous submissions</h3>
            <p className="workspace-empty__text">
              Once you submit a registration, that semester's record will appear here with your
              information, documents, and clearance results.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => onSwitchTab('registration')}>
              Start registration
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

/* -------------------------------------------------------
   RegistrationTab — hosts the seven-step registration wizard
   (POST /applications, then POST /applications/{id}/documents for
   each staged file — see registrationAdapter.js).
------------------------------------------------------- */
function RegistrationTab({ currentSession, applications, onRegistrationSubmitted, onSwitchTab }) {
  return (
    <div className="workspace-panel">
      <div className="workspace-panel__intro">
        <h1 className="workspace-hero__title">Submit a registration</h1>
        <p className="workspace-hero__subtitle">
          Complete each office's section below to submit a new term to the Registrar for review.
        </p>
      </div>
      <RegistrationWizard
        currentSession={currentSession}
        applications={applications}
        onRegistrationSubmitted={onRegistrationSubmitted}
        onSwitchTab={onSwitchTab}
      />
    </div>
  )
}

/* -------------------------------------------------------
   ClearancesTab — office grid + single-office detail
------------------------------------------------------- */
function ClearancesTab({ application, selectedClearanceId, onSelectClearance, onSwitchTab }) {
  if (!application) {
    return (
      <div className="workspace-panel">
        <div className="workspace-empty">
          <h3 className="workspace-empty__title">No registration to show yet</h3>
          <p className="workspace-empty__text">Submit a registration to see your office clearances here.</p>
          <button type="button" className="btn btn--primary" onClick={() => onSwitchTab('registration')}>
            Start registration
          </button>
        </div>
      </div>
    )
  }

  const clearances = application.clearances || []
  const detail = clearances.find((c) => c.id === selectedClearanceId) || null

  if (detail) {
    return (
      <div className="workspace-panel">
        <button type="button" className="workspace-back" onClick={() => onSelectClearance(null)}>
          ← All clearances
        </button>
        <div className="workspace-card">
          <div className="workspace-card__head">
            <div>
              <span className="workspace-callout__eyebrow">Clearance detail · {application.term_code}</span>
              <h1 className="workspace-hero__title">{detail.clearance_label}</h1>
              <p className="workspace-card__subtitle">{formatAvailability(detail.availability)}</p>
            </div>
            <StatusBadge status={clearanceDisplayLabel(detail)} />
          </div>

          <div className="workspace-note">
            <span className="workspace-note__label">Office message</span>
            <p className="workspace-note__text">
              {detail.message || detail.blocked_reason || 'No message from this office yet.'}
            </p>
          </div>

          <div className="workspace-info-grid">
            <div className="workspace-info-cell">
              <span className="workspace-info-cell__label">Required</span>
              <span className="workspace-info-cell__value">{detail.is_required ? 'Yes' : 'No'}</span>
            </div>
            <div className="workspace-info-cell">
              <span className="workspace-info-cell__label">Opened</span>
              <span className="workspace-info-cell__value">{formatDate(detail.opened_at)}</span>
            </div>
            <div className="workspace-info-cell">
              <span className="workspace-info-cell__label">Reviewed</span>
              <span className="workspace-info-cell__value">{formatDate(detail.reviewed_at)}</span>
            </div>
            <div className="workspace-info-cell">
              <span className="workspace-info-cell__label">Completed</span>
              <span className="workspace-info-cell__value">{formatDate(detail.completed_at)}</span>
            </div>
          </div>

          <div className="workspace-card__actions">
            {clearanceNeedsAction(detail) && (
              <button type="button" className="btn btn--primary" onClick={() => onSwitchTab('documents')}>
                Go to documents
              </button>
            )}
            <button type="button" className="btn btn--outline" onClick={() => onSwitchTab('help')}>
              Contact {detail.clearance_label}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="workspace-panel">
      <div>
        <h1 className="workspace-hero__title">Campus clearances</h1>
        <p className="workspace-hero__subtitle">
          {clearances.filter(clearanceIsDone).length} of {clearances.length} offices have approved your{' '}
          {application.term_code} registration.
        </p>
      </div>
      <div className="workspace-office-grid">
        {clearances.map((clearance) => (
          <div key={clearance.id} className="workspace-office-card">
            <div className="workspace-office-card__top">
              <span className="workspace-office-card__name">{clearance.clearance_label}</span>
              <span className="workspace-office-row__icon" aria-hidden="true">{officeInitials(clearance.clearance_label)}</span>
            </div>
            <StatusBadge status={clearanceDisplayLabel(clearance)} />
            <span className="workspace-office-card__meta">{formatAvailability(clearance.availability)}</span>
            <button
              type="button"
              className="btn btn--outline btn--small"
              onClick={() => onSelectClearance(clearance.id)}
            >
              View details
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   DocumentsPanel — one application's documents + upload form
   (GET/POST /applications/{id}/documents)
------------------------------------------------------- */
function DocumentsPanel({ applicationId }) {
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [documents, setDocuments] = useState([])

  const [documentType, setDocumentType]   = useState(DOCUMENT_TYPE_OPTIONS[0].value)
  const [file, setFile]                   = useState(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState('')
  const [uploadMessage, setUploadMessage] = useState('')

  const loadDocuments = useCallback(() => {
    setLoading(true)
    setError('')
    getApplicationDocuments(applicationId)
      .then(setDocuments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [applicationId])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!file) {
      setUploadError('Please choose a file to upload.')
      return
    }
    setUploading(true)
    setUploadError('')
    setUploadMessage('')
    try {
      const result = await uploadDocument(applicationId, documentType, file)
      setUploadMessage(result.message)
      setFile(null)
      event.target.reset()
      loadDocuments()
    } catch (err) {
      setUploadError(err.message || 'Could not upload this document.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="workspace-card">
      <h2 className="workspace-card__title">Upload a document</h2>
      <form className="document-upload-form" onSubmit={handleUpload}>
        <label className="form-field">
          <span className="form-field__label">Document type</span>
          <select
            className="form-field__control"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            disabled={uploading}
          >
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <input
          type="file"
          className="document-upload-form__file"
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          onChange={(event) => setFile(event.target.files[0] || null)}
          disabled={uploading}
        />
        <button type="submit" className="btn btn--primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </form>

      {uploadError && <p className="form-status form-status--error">{uploadError}</p>}
      {uploadMessage && <p className="form-status form-status--success">{uploadMessage}</p>}

      {loading && <p className="portal-status-panel__loading">Loading documents…</p>}
      {error && <p className="portal-status-panel__error">{error}</p>}
      {!loading && !error && (
        documents.length === 0 ? (
          <div className="workspace-empty workspace-empty--tight">
            <h3 className="workspace-empty__title">No documents for this semester</h3>
            <p className="workspace-empty__text">
              Documents you upload will be listed here with their review status.
            </p>
          </div>
        ) : (
          <DocumentList documents={documents} />
        )
      )}
    </div>
  )
}

function DocumentsTab({ applications, selectedAppId, onSelectApp, onSwitchTab }) {
  const selectedApp = applications.find((app) => app.id === selectedAppId) || null

  return (
    <div className="workspace-panel">
      <div>
        <h1 className="workspace-hero__title">Documents</h1>
        <p className="workspace-hero__subtitle">Everything you have uploaded, by semester.</p>
      </div>

      {applications.length === 0 ? (
        <div className="workspace-empty">
          <h3 className="workspace-empty__title">No documents yet</h3>
          <p className="workspace-empty__text">Submit a registration first — its document checklist will appear here.</p>
          <button type="button" className="btn btn--primary" onClick={() => onSwitchTab('registration')}>
            Start registration
          </button>
        </div>
      ) : (
        <>
          <div className="workspace-filters">
            <span className="workspace-filters__label">Semester</span>
            {applications.map((app) => (
              <button
                key={app.id}
                type="button"
                aria-pressed={selectedAppId === app.id}
                className={`workspace-filter${selectedAppId === app.id ? ' workspace-filter--active' : ''}`}
                onClick={() => onSelectApp(app.id)}
              >
                {app.term_code}
              </button>
            ))}
          </div>
          {selectedApp && <DocumentsPanel applicationId={selectedApp.id} />}
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------
   ActivityPanel / ActivityTab — GET /applications/{id}/activity
------------------------------------------------------- */
function ActivityPanel({ applicationId }) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activity, setActivity] = useState([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getApplicationActivity(applicationId)
      .then((result) => { if (!cancelled) setActivity(result.activity) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [applicationId])

  if (loading) return <p className="portal-status-panel__loading">Loading activity…</p>
  if (error) return <p className="portal-status-panel__error">{error}</p>

  return (
    <div className="workspace-card">
      <ActivityTimeline activity={activity} />
    </div>
  )
}

function ActivityTab({ applications, selectedAppId, onSwitchTab }) {
  const selectedApp = applications.find((app) => app.id === selectedAppId) || null

  return (
    <div className="workspace-panel">
      <div>
        <h1 className="workspace-hero__title">Activity</h1>
        <p className="workspace-hero__subtitle">A record of every update to your registration.</p>
      </div>
      {selectedApp ? (
        <ActivityPanel applicationId={selectedApp.id} />
      ) : (
        <div className="workspace-empty">
          <h3 className="workspace-empty__title">No activity yet</h3>
          <p className="workspace-empty__text">Submit a registration to start building an activity record.</p>
          <button type="button" className="btn btn--primary" onClick={() => onSwitchTab('registration')}>
            Start registration
          </button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------
   HelpTab — static contact directory + FAQs
------------------------------------------------------- */
const HELP_OFFICES = [
  'Registrar', 'Health Services', 'Success Center', 'Financial Aid',
  'Business Office', 'Residence Life', 'Public Safety',
]

const HELP_FAQS = [
  {
    q: 'What does “Correction Required” mean?',
    a: 'An office needs something from you before it can approve your clearance — open that clearance to see its message.',
  },
  {
    q: 'How will I know when an office approves me?',
    a: 'Your Activity tab and your college email are updated each time an office records a decision.',
  },
  {
    q: 'Can I edit a registration after I submit it?',
    a: 'Not from the portal. Contact the Registrar’s Office directly if something needs to change.',
  },
  {
    q: 'Who do I contact if a clearance seems wrong?',
    a: 'Contact the Registrar’s Office — they can route your question to the right office.',
  },
]

function HelpTab() {
  return (
    <div className="workspace-panel">
      <div>
        <h1 className="workspace-hero__title">Help</h1>
        <p className="workspace-hero__subtitle">
          Every office listed below is reached through the Registrar's Office.
        </p>
      </div>

      <div className="workspace-card">
        <h2 className="workspace-card__title">Office of the Registrar</h2>
        <p className="workspace-card__subtitle">Registration, records, clearances, and final review.</p>
        <p className="workspace-help-contact">704-216-6001</p>
        <a className="workspace-help-contact" href="mailto:registrar@livingstone.edu">registrar@livingstone.edu</a>
        <p className="workspace-card__subtitle">Mon–Fri, 8:30 a.m.–5 p.m.</p>
      </div>

      <div className="workspace-office-grid">
        {HELP_OFFICES.map((office) => (
          <div key={office} className="workspace-office-card workspace-office-card--static">
            <span className="workspace-office-card__name">{office}</span>
            <span className="workspace-office-card__meta">Routed through the Registrar's Office.</span>
          </div>
        ))}
      </div>

      <div className="workspace-faq">
        <h2 className="workspace-card__title">Common questions</h2>
        {HELP_FAQS.map((faq) => (
          <div key={faq.q} className="workspace-faq__item">
            <span className="workspace-faq__q">{faq.q}</span>
            <span className="workspace-faq__a">{faq.a}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   StudentPortal — the student workspace shell

   Session is passed down from App.jsx (restored via GET /auth/me),
   so this page trusts currentSession rather than reading localStorage.
------------------------------------------------------- */
function StudentPortal({ onNavigate, currentSession }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')

  // /student-portal/registration is the one tab with its own URL (see
  // App.jsx's dedicated, guarded route) — landing there opens straight
  // to Registration, and reloading the page keeps you there instead of
  // dropping back to Overview.
  const isRegistrationRoute = location.pathname === STUDENT_REGISTRATION_PATH
  const [activeTab, setActiveTab]                   = useState(isRegistrationRoute ? 'registration' : 'overview')
  const [selectedAppId, setSelectedAppId]           = useState(null)
  const [selectedClearanceId, setSelectedClearanceId] = useState(null)

  useEffect(() => {
    if (isRegistrationRoute) setActiveTab('registration')
  }, [isRegistrationRoute])

  const isStudentSession = currentSession?.account_type === 'student'

  const loadApplications = useCallback(() => {
    setLoading(true)
    setError('')
    getMyApplications()
      .then((result) => {
        const sorted = [...result].sort((a, b) => {
          const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
          const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
          return bTime - aTime
        })
        setApplications(sorted)
        setSelectedAppId((current) => current && sorted.some((app) => app.id === current)
          ? current
          : sorted[0]?.id ?? null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (isStudentSession) loadApplications()
  }, [isStudentSession, loadApplications])

  const selectedApp = useMemo(
    () => applications.find((app) => app.id === selectedAppId) || null,
    [applications, selectedAppId]
  )

  const actionCount = useMemo(
    () => (selectedApp?.clearances || []).filter(clearanceNeedsAction).length,
    [selectedApp]
  )

  const handleSwitchTab = (tab) => {
    // Keep the URL honest about which tab is showing: the Registration
    // tab always lives at its own canonical route, every other tab at
    // the plain workspace URL. That way a reload always lands back on
    // whichever section was actually open.
    if (tab === 'registration' && location.pathname !== STUDENT_REGISTRATION_PATH) {
      navigate(STUDENT_REGISTRATION_PATH)
    } else if (tab !== 'registration' && location.pathname === STUDENT_REGISTRATION_PATH) {
      navigate(STUDENT_PORTAL_PATH)
    }
    setActiveTab(tab)
    if (tab !== 'clearances') setSelectedClearanceId(null)
  }

  const handleSelectApp = (appId) => {
    setSelectedAppId(appId)
    setSelectedClearanceId(null)
  }

  if (!isStudentSession) {
    return (
      <div className="workspace">
        <GuestNotice onNavigate={onNavigate} />
      </div>
    )
  }

  const disabledTabs = applications.length === 0 ? ['clearances', 'documents', 'activity'] : []

  return (
    <div className="workspace">
      <div className="workspace-shell">
        <WorkspaceNav
          activeTab={activeTab}
          onSelect={handleSwitchTab}
          actionCount={actionCount}
          disabledTabs={disabledTabs}
        />

        <main className="workspace-main">
          {loading && <LoadingSkeleton />}
          {!loading && error && <ErrorState message={error} onRetry={loadApplications} />}

          {!loading && !error && (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  applications={applications}
                  selectedApp={selectedApp}
                  onSelectApp={handleSelectApp}
                  onSwitchTab={handleSwitchTab}
                  onSelectClearance={setSelectedClearanceId}
                  displayName={deriveDisplayName(currentSession?.email)}
                />
              )}
              {activeTab === 'registration' && (
                <RegistrationTab
                  currentSession={currentSession}
                  applications={applications}
                  onRegistrationSubmitted={loadApplications}
                  onSwitchTab={handleSwitchTab}
                />
              )}
              {activeTab === 'clearances' && (
                <ClearancesTab
                  application={selectedApp}
                  selectedClearanceId={selectedClearanceId}
                  onSelectClearance={setSelectedClearanceId}
                  onSwitchTab={handleSwitchTab}
                />
              )}
              {activeTab === 'documents' && (
                <DocumentsTab
                  applications={applications}
                  selectedAppId={selectedAppId}
                  onSelectApp={handleSelectApp}
                  onSwitchTab={handleSwitchTab}
                />
              )}
              {activeTab === 'activity' && (
                <ActivityTab
                  applications={applications}
                  selectedAppId={selectedAppId}
                  onSwitchTab={handleSwitchTab}
                />
              )}
              {activeTab === 'help' && <HelpTab />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default StudentPortal
