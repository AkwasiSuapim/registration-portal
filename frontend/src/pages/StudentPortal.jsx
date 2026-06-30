import { useState, useEffect } from 'react'
import {
  CLEARANCE_KEYS,
  getClearanceLabel,
  loadApplications,
} from '../utils/registrationWorkflow'

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
   Helper — derive a short Application ID from submittedAt
------------------------------------------------------- */
function formatApplicationId(submittedAt) {
  if (!submittedAt) return 'APP-DRAFT'
  const date = submittedAt.slice(0, 10).replace(/-/g, '')
  const time = submittedAt.slice(11, 16).replace(':', '')
  return `APP-${date}-${time}`
}

/* -------------------------------------------------------
   Helper — CSS slug for any status string
------------------------------------------------------- */
function statusSlug(status) {
  if (!status) return 'pending'
  return status.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')
}

/* -------------------------------------------------------
   StatusBadge — coloured pill for any status value
------------------------------------------------------- */
function StatusBadge({ status }) {
  const display = status || 'Pending'
  return (
    <span className={`status-badge status-badge--${statusSlug(display)}`}>
      {display}
    </span>
  )
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
   ClearanceTracker — shows the status of all five
   clearances for one application
------------------------------------------------------- */
function ClearanceTracker({ clearances }) {
  return (
    <div className="clearance-tracker">
      {CLEARANCE_KEYS.map((key) => {
        const clearance = clearances?.[key]
        const status    = clearance?.status || 'Pending'

        return (
          <div key={key} className={`clearance-track-row clearance-track-row--${statusSlug(status)}`}>
            <div className="clearance-track-row__top">
              <span className="clearance-track-row__label">{getClearanceLabel(key)}</span>
              <StatusBadge status={status} />
            </div>

            {/* Show reviewer info when available */}
            {clearance?.reviewedBy && (
              <p className="clearance-track-row__meta">
                Reviewed by {clearance.reviewedBy} on {formatDate(clearance.reviewedAt)}
              </p>
            )}

            {/* Show the office message to the student when available */}
            {clearance?.message && (
              <p className="clearance-track-row__office-message">
                {clearance.message}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------
   ApplicationStatusCard — student-facing summary card
   for one submitted application
------------------------------------------------------- */
function ApplicationStatusCard({ application }) {
  const {
    fullName, studentId, registrationTerm, major,
    totalCreditHours, submittedAt,
    clearances   = {},
    overallStatus = 'In Progress',
  } = application

  return (
    <div className="portal-app-card">

      {/* Card header */}
      <div className="portal-app-card__header">
        <div>
          <p className="portal-app-card__app-id">{formatApplicationId(submittedAt)}</p>
          <h2 className="portal-app-card__name">{fullName || '—'}</h2>
        </div>
        <StatusBadge status={overallStatus} />
      </div>

      {/* Quick summary row */}
      <div className="portal-app-card__summary">
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Student ID</span>
          <span className="portal-app-card__summary-value">{studentId || '—'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Term</span>
          <span className="portal-app-card__summary-value">{registrationTerm || '—'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Major</span>
          <span className="portal-app-card__summary-value">{major || '—'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Credit Hours</span>
          <span className="portal-app-card__summary-value">{totalCreditHours ?? '—'}</span>
        </div>
        <div className="portal-app-card__summary-item">
          <span className="portal-app-card__summary-label">Submitted</span>
          <span className="portal-app-card__summary-value">{formatDate(submittedAt)}</span>
        </div>
      </div>

      {/* Next step guidance */}
      <NextStepMessage overallStatus={overallStatus} />

      {/* Office clearance tracker */}
      <div className="portal-app-card__clearances">
        <h3 className="portal-app-card__clearances-title">Office Clearances</h3>
        <ClearanceTracker clearances={clearances} />
      </div>

    </div>
  )
}

/* -------------------------------------------------------
   StudentPortal — main page component

   This is frontend-only access control for the prototype.
   Real authorization will be enforced by the backend later.
------------------------------------------------------- */
function StudentPortal({ onNavigate }) {
  const [applications, setApplications] = useState([])

  // Read the session synchronously so the correct view renders immediately
  // without a flash of wrong content on first paint.
  const currentSession = JSON.parse(localStorage.getItem('portalUserSession') || 'null')
  const isStudentSession = currentSession?.userType === 'student'

  useEffect(() => {
    const apps = loadApplications()
    setApplications(apps)
  }, [])

  // Filter to only the applications that belong to the logged-in student.
  // We match on studentId first, then fall back to email for flexibility.
  const matchingApplications = isStudentSession
    ? applications.filter((app) =>
        (currentSession.studentId && app.studentId === currentSession.studentId) ||
        (currentSession.email && (
          app.email === currentSession.email ||
          app.livingstoneEmail === currentSession.email
        ))
      )
    : []

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

  // Student is logged in but no application matches their account
  if (matchingApplications.length === 0) {
    return (
      <div className="student-portal">
        {pageHeader}
        <div className="admin-empty">
          <svg className="admin-empty__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
          <p className="admin-empty__text">
            No registration application found for this student account.
          </p>
          <p className="admin-empty__hint">
            If you have already submitted, make sure your Student ID and email match
            the information used during registration.
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

  // Student is logged in and has at least one matching application
  return (
    <div className="student-portal">
      {pageHeader}
      <div className="portal-app-list">
        {matchingApplications.map((app, index) => (
          <ApplicationStatusCard key={app.submittedAt || index} application={app} />
        ))}
      </div>
    </div>
  )
}

export default StudentPortal
