import { useState, useEffect, useCallback } from 'react'
import { getMyApplications, getApplicationStatus, getApplicationDocuments, getApplicationActivity, uploadDocument } from '../services/api'
import { formatOverallStatus, formatClearanceStatus, formatAvailability, statusSlug, DOCUMENT_TYPE_OPTIONS } from '../utils/backendLabels'
import StatusBadge from '../components/StatusBadge'
import DocumentList from '../components/DocumentList'
import ActivityTimeline from '../components/ActivityTimeline'

/* -------------------------------------------------------
   Helper — format ISO timestamp for display
------------------------------------------------------- */
function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* -------------------------------------------------------
   NextStepMessage — student-friendly guidance based on
   the current overall registration status
------------------------------------------------------- */
function NextStepMessage({ overallStatus }) {
  const messages = {
    'Fully Registered':    'Your registration is fully approved. You are fully registered.',
    'In Progress':         'Your registration is being reviewed by the required offices.',
    'Correction Required': 'One or more offices requested a correction. Review the message below and update your information if needed.',
    'Rejected':            'Your registration was rejected. Please contact the appropriate office for next steps.',
    'In-Person Required':  'Your digital clearances are nearly complete. Please visit Public Safety for any required in-person ID processing.',
  }

  const text = messages[overallStatus] || messages['In Progress']
  const variant = statusSlug(overallStatus)

  return (
    <div className={`next-step-message next-step-message--${variant}`}>
      <p className="next-step-message__text">{text}</p>
    </div>
  )
}

/* -------------------------------------------------------
   ClearanceTracker — shows every clearance returned by
   GET /applications/{id}/status, in the order the backend sends them
------------------------------------------------------- */
function ClearanceTracker({ clearances }) {
  return (
    <div className="clearance-tracker">
      {clearances.map((clearance) => {
        const displayStatus = formatClearanceStatus(clearance.status)
        return (
          <div
            key={clearance.id}
            className={`clearance-track-row clearance-track-row--${statusSlug(displayStatus)}`}
          >
            <div className="clearance-track-row__top">
              <span className="clearance-track-row__label">{clearance.clearance_label}</span>
              <StatusBadge status={displayStatus} />
            </div>

            <p className="clearance-track-row__meta">
              {formatAvailability(clearance.availability)}
              {clearance.reviewed_at && ` · Reviewed ${formatDate(clearance.reviewed_at)}`}
            </p>

            {/* Why a locked clearance can't be acted on yet */}
            {clearance.availability === 'locked' && clearance.blocked_reason && (
              <p className="clearance-track-row__office-message">{clearance.blocked_reason}</p>
            )}

            {/* Any note the reviewing office left */}
            {clearance.message && (
              <p className="clearance-track-row__office-message">{clearance.message}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------
   StatusPanel — fetches GET /applications/{id}/status on demand,
   toggled per application card so we don't load every clearance
   tracker up front.
------------------------------------------------------- */
function StatusPanel({ applicationId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [data, setData]       = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    getApplicationStatus(applicationId)
      .then((result) => { if (!cancelled) setData(result) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [applicationId])

  if (loading) {
    return <p className="portal-status-panel__loading">Loading status details…</p>
  }

  if (error) {
    return <p className="portal-status-panel__error">{error}</p>
  }

  return (
    <div className="portal-app-card__clearances">
      <h3 className="portal-app-card__clearances-title">Office Clearances</h3>
      <ClearanceTracker clearances={data.clearances} />
    </div>
  )
}

/* -------------------------------------------------------
   DocumentsPanel — lists + uploads documents for one application
   (POST/GET /applications/{id}/documents), toggled on demand.
------------------------------------------------------- */
function DocumentsPanel({ applicationId }) {
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [documents, setDocuments] = useState([])

  const [documentType, setDocumentType] = useState(DOCUMENT_TYPE_OPTIONS[0].value)
  const [file, setFile]                 = useState(null)
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState('')
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
    <div className="portal-app-card__section">
      <h3 className="portal-app-card__section-title">Documents</h3>

      <form className="document-upload-form" onSubmit={handleUpload}>
        <label className="form-field">
          <span className="form-field__label">Document type</span>
          <select
            className="form-field__control"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
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
        />
        <button type="submit" className="btn btn--primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </form>

      {uploadError && <p className="form-status form-status--error">{uploadError}</p>}
      {uploadMessage && <p className="form-status form-status--success">{uploadMessage}</p>}

      {loading && <p className="portal-status-panel__loading">Loading documents…</p>}
      {error && <p className="portal-status-panel__error">{error}</p>}
      {!loading && !error && <DocumentList documents={documents} />}
    </div>
  )
}

/* -------------------------------------------------------
   ActivityPanel — fetches GET /applications/{id}/activity
   for the student's own application, toggled on demand.
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
    <div className="portal-app-card__section">
      <h3 className="portal-app-card__section-title">Activity</h3>
      <ActivityTimeline activity={activity} />
    </div>
  )
}

/* -------------------------------------------------------
   ApplicationStatusCard — student-facing summary card
   for one submitted application (GET /students/me/applications)
------------------------------------------------------- */
function ApplicationStatusCard({ application }) {
  const [showStatus, setShowStatus]         = useState(false)
  const [showDocuments, setShowDocuments]   = useState(false)
  const [showActivity, setShowActivity]     = useState(false)

  const {
    id, application_number, term_code, academic_year, major, classification,
    housing_required, total_credit_hours, overall_status,
    submitted_at, courses = [],
  } = application

  const overallStatusLabel = formatOverallStatus(overall_status)

  return (
    <div className="portal-app-card">

      {/* Card header */}
      <div className="portal-app-card__header">
        <div>
          <p className="portal-app-card__app-id">{application_number}</p>
          <h2 className="portal-app-card__name">{term_code} · {academic_year}</h2>
        </div>
        <StatusBadge status={overallStatusLabel} />
      </div>

      {/* Quick summary row */}
      <div className="portal-app-card__summary">
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Major</span>
          <span className="portal-app-card__summary-value">{major || '—'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Classification</span>
          <span className="portal-app-card__summary-value">{classification || '—'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Housing Required</span>
          <span className="portal-app-card__summary-value">{housing_required ? 'Yes' : 'No'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Total Credit Hours</span>
          <span className="portal-app-card__summary-value">{total_credit_hours ?? '—'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Submitted At</span>
          <span className="portal-app-card__summary-value">{formatDate(submitted_at)}</span>
        </div>
      </div>

      {/* Next step guidance */}
      <NextStepMessage overallStatus={overallStatusLabel} />

      {/* Selected courses */}
      {courses.length > 0 && (
        <div className="portal-app-card__section">
          <h3 className="portal-app-card__section-title">Selected Courses</h3>
          <div className="portal-course-list">
            {courses.map((course) => (
              <div key={course.id} className="portal-course-row">
                <span className="portal-course-row__code">{course.course_code}</span>
                <span className="portal-course-row__title">{course.course_title}</span>
                <span className="portal-course-row__credits">{course.credit_hours} credits</span>
                <span className="portal-course-row__schedule">{course.section || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Office clearance tracker, documents, and activity — each fetched on demand */}
      <div className="portal-app-card__toggles">
        <button
          type="button"
          className="btn btn--outline portal-app-card__status-toggle"
          onClick={() => setShowStatus((prev) => !prev)}
        >
          {showStatus ? 'Hide Status Details' : 'View Status Details'}
        </button>
        <button
          type="button"
          className="btn btn--outline portal-app-card__status-toggle"
          onClick={() => setShowDocuments((prev) => !prev)}
        >
          {showDocuments ? 'Hide Documents' : 'Manage Documents'}
        </button>
        <button
          type="button"
          className="btn btn--outline portal-app-card__status-toggle"
          onClick={() => setShowActivity((prev) => !prev)}
        >
          {showActivity ? 'Hide Activity' : 'View Activity'}
        </button>
      </div>

      {showStatus && <StatusPanel applicationId={id} />}
      {showDocuments && <DocumentsPanel applicationId={id} />}
      {showActivity && <ActivityPanel applicationId={id} />}

    </div>
  )
}

/* -------------------------------------------------------
   StudentPortal — main page component

   Session is passed down from App.jsx (restored via GET /auth/me),
   so this page trusts currentSession rather than reading localStorage.
------------------------------------------------------- */
function StudentPortal({ onNavigate, currentSession }) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')

  const isStudentSession = currentSession?.account_type === 'student'

  const loadApplications = useCallback(() => {
    setLoading(true)
    setError('')
    getMyApplications()
      .then(setApplications)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (isStudentSession) loadApplications()
  }, [isStudentSession, loadApplications])

  // Shared page header used in all states below
  const pageHeader = (
    <div className="student-portal__header">
      <div>
        <p className="student-portal__eyebrow">Registration Status</p>
        <h1 className="student-portal__title">Student Portal</h1>
        <p className="student-portal__desc">
          Track the status of your submitted registration application and
          see the review progress across all required offices.
        </p>
      </div>
      <button
        type="button"
        className="btn btn--outline"
        onClick={() => onNavigate('home')}
      >
        ← Back to Home
      </button>
    </div>
  )

  // No session or the logged-in user is not a student
  if (!isStudentSession) {
    return (
      <div className="student-portal">
        {pageHeader}
        <div className="portal-guest-notice">
          <svg className="portal-guest-notice__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
          <p className="portal-guest-notice__text">
            Please log in as a student to view your registration status.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onNavigate('login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // Applications are still loading
  if (loading) {
    return (
      <div className="student-portal">
        {pageHeader}
        <p className="portal-loading">Loading your applications…</p>
      </div>
    )
  }

  // The backend request failed (validation, auth, or the server is unreachable)
  if (error) {
    return (
      <div className="student-portal">
        {pageHeader}
        <div className="admin-empty">
          <svg className="admin-empty__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <p className="admin-empty__text">We couldn't load your applications.</p>
          <p className="admin-empty__hint">{error}</p>
          <button type="button" className="btn btn--primary" onClick={loadApplications}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Student is logged in but has not submitted any application yet
  if (applications.length === 0) {
    return (
      <div className="student-portal">
        {pageHeader}
        <div className="admin-empty">
          <svg className="admin-empty__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
          <p className="admin-empty__text">
            You have not submitted a registration application yet.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onNavigate('register')}
          >
            Start Registration
          </button>
        </div>
      </div>
    )
  }

  // Student is logged in and has at least one application on record
  return (
    <div className="student-portal">
      {pageHeader}
      <div className="portal-app-list">
        {applications.map((app) => (
          <ApplicationStatusCard key={app.id} application={app} />
        ))}
      </div>
    </div>
  )
}

export default StudentPortal
