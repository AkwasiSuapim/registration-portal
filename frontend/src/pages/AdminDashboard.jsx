import { useState, useEffect, useCallback } from 'react'
import { getOfficialQueue, getApplicationReview, updateClearance, getApplicationActivity } from '../services/api'
import { formatOverallStatus, formatClearanceStatus, getOwnClearanceKey } from '../utils/backendLabels'
import { getClearanceLabel, getAllowedClearanceKey } from '../utils/registrationWorkflow'
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
   RoleBanner — shows the active office role at the top.
   Logout is handled by the Navbar; no secondary logout here.
------------------------------------------------------- */
function RoleBanner({ officeRole }) {
  const allowedKey = getAllowedClearanceKey(officeRole)
  const clearanceLabel = allowedKey ? getClearanceLabel(allowedKey) : null
  return (
    <div className="role-banner">
      <div className="role-banner__info">
        <span className="role-banner__label">Logged in as</span>
        <span className="role-banner__role">{officeRole}</span>
        {clearanceLabel && (
          <span className="role-banner__owns">
            Managing: <strong>{clearanceLabel}</strong>
          </span>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   ClearanceActionBlock — one clearance in the review panel.
   Only the office that owns this clearance_key sees action buttons;
   every other office sees the same block read-only.
------------------------------------------------------- */
function ClearanceActionBlock({ clearance, canAct, isPublicSafety, onSubmitAction }) {
  const [message, setMessage]         = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [actionError, setActionError] = useState('')

  const displayStatus = formatClearanceStatus(clearance.status)
  const showActions   = canAct && clearance.availability === 'ready'

  const handleAction = async (action) => {
    if ((action === 'request_correction' || action === 'reject') && !message.trim()) {
      setActionError('Please enter a message explaining why.')
      return
    }

    setSubmitting(true)
    setActionError('')

    try {
      await onSubmitAction(clearance.id, action, message.trim() || null)
      setMessage('')
    } catch (err) {
      // Backend is authoritative here — surface its message verbatim
      // (wrong office = 403, locked clearance = 409, missing message = 422, etc).
      setActionError(err.message || 'Could not update this clearance.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`clearance-section${showActions ? ' clearance-section--assigned' : ' clearance-section--readonly'}`}>
      <div className="clearance-section__header">
        <div className="clearance-section__title-row">
          <span className="clearance-section__label">{clearance.clearance_label}</span>
          <StatusBadge status={displayStatus} />
        </div>
        {!canAct && (
          <span className="clearance-section__viewonly">
            View only — assigned to another office.
          </span>
        )}
      </div>

      {clearance.reviewed_at && (
        <div className="clearance-section__meta">
          <span>Reviewed on {formatDate(clearance.reviewed_at)}</span>
        </div>
      )}

      {/* Why a locked clearance can't be acted on — shown even to the owning office */}
      {clearance.availability === 'locked' && clearance.blocked_reason && (
        <p className="clearance-section__message">{clearance.blocked_reason}</p>
      )}

      {clearance.message && (
        <p className="clearance-section__message">{clearance.message}</p>
      )}

      {showActions && (
        <div className="clearance-section__actions">
          <textarea
            className="clearance-section__textarea"
            placeholder="Message (required for Request Correction / Reject — shown to the student)…"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            disabled={submitting}
          />

          {actionError && <p className="clearance-section__error">{actionError}</p>}

          <div className="clearance-section__buttons">
            <button
              type="button"
              className="status-action-btn status-action-btn--approved"
              disabled={submitting}
              onClick={() => handleAction('approve')}
            >
              Approve
            </button>
            <button
              type="button"
              className="status-action-btn status-action-btn--correction-required"
              disabled={submitting}
              onClick={() => handleAction('request_correction')}
            >
              Request Correction
            </button>
            <button
              type="button"
              className="status-action-btn status-action-btn--rejected"
              disabled={submitting}
              onClick={() => handleAction('reject')}
            >
              Reject
            </button>
            {/* Only Public Safety can flag that an in-person visit is needed */}
            {isPublicSafety && (
              <button
                type="button"
                className="status-action-btn status-action-btn--in-person-required"
                disabled={submitting}
                onClick={() => handleAction('mark_in_person_required')}
              >
                Mark In-Person Required
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------
   ReviewActivity — fetches GET /applications/{id}/activity
   for the review panel, toggled on demand.
------------------------------------------------------- */
function ReviewActivity({ applicationId }) {
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

  if (loading) return <p className="app-detail__empty">Loading activity…</p>
  if (error) return <p className="app-detail__empty">{error}</p>
  return <ActivityTimeline activity={activity} />
}

/* -------------------------------------------------------
   ReviewPanel — full review for one application
   (GET /applications/{id}/review), shown when a queue row is opened.
------------------------------------------------------- */
function ReviewPanel({ applicationId, ownClearanceKey, isPublicSafety, onClose, onQueueChanged }) {
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [review, setReview]           = useState(null)
  const [showActivity, setShowActivity] = useState(false)

  const loadReview = useCallback(() => {
    setLoading(true)
    setError('')
    getApplicationReview(applicationId)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [applicationId])

  useEffect(() => { loadReview() }, [loadReview])

  // Only refreshes on success — a thrown ApiError propagates back up to
  // the clearance block that called this, so it can show its own error.
  const handleClearanceAction = async (clearanceId, action, message) => {
    await updateClearance(clearanceId, { action, message })
    loadReview()
    onQueueChanged()
  }

  if (loading) {
    return (
      <div className="app-detail">
        <p className="app-detail__empty">Loading application review…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-detail">
        <p className="app-detail__empty">{error}</p>
        <button type="button" className="btn btn--outline" onClick={onClose}>Close</button>
      </div>
    )
  }

  const {
    id, application_number, term_code, academic_year, major, classification,
    housing_required, overall_status, submitted_at, total_credit_hours,
    student, courses = [], clearances = [], documents = [],
  } = review

  return (
    <div className="app-detail">

      {/* Panel header */}
      <div className="app-detail__header">
        <div className="app-detail__header-info">
          <p className="app-detail__app-id">{application_number}</p>
          <h2 className="app-detail__student-name">{student.first_name} {student.last_name}</h2>
          <div className="app-detail__overall-status">
            <span className="app-detail__overall-label">Overall Status:</span>
            <StatusBadge status={formatOverallStatus(overall_status)} />
          </div>
        </div>
        <button type="button" className="btn btn--outline" onClick={onClose}>
          ✕ Close Details
        </button>
      </div>

      {/* Student & application information */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">Student Information</h3>
        <div className="app-detail__grid">
          <div className="app-detail__field">
            <span className="app-detail__label">Student Number</span>
            <span className="app-detail__value">{student.student_no}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">College Email</span>
            <span className="app-detail__value">{student.livingstone_email}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Residency</span>
            <span className="app-detail__value">
              {student.residency_type === 'residential' ? 'Residential' : 'Commuter'}
            </span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Term</span>
            <span className="app-detail__value">{term_code} ({academic_year})</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Major</span>
            <span className="app-detail__value">{major || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Classification</span>
            <span className="app-detail__value">{classification || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Housing Required</span>
            <span className="app-detail__value">{housing_required ? 'Yes' : 'No'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Submitted At</span>
            <span className="app-detail__value">{formatDate(submitted_at)}</span>
          </div>
        </div>
      </section>

      {/* Selected courses */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">
          Selected Courses
          {total_credit_hours > 0 && (
            <span className="app-detail__credit-badge">{total_credit_hours} credit hours</span>
          )}
        </h3>
        {courses.length === 0 ? (
          <p className="app-detail__empty">No courses on record.</p>
        ) : (
          <div className="app-detail__course-list">
            <div className="app-detail__course-header">
              <span>Code</span><span>Title</span><span>Credits</span><span>Section</span>
            </div>
            {courses.map((course) => (
              <div key={course.id} className="app-detail__course-row">
                <span className="app-detail__course-code">{course.course_code}</span>
                <span className="app-detail__course-title">{course.course_title}</span>
                <span className="app-detail__course-credits">{course.credit_hours}</span>
                <span className="app-detail__course-schedule">{course.section || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Uploaded documents — view/download only, officials never upload */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">Uploaded Documents</h3>
        <DocumentList documents={documents} />
      </section>

      {/* Clearance sections — one block per office */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">Office Clearances</h3>
        <div className="clearance-list">
          {clearances.map((clearance) => (
            <ClearanceActionBlock
              key={clearance.id}
              clearance={clearance}
              canAct={clearance.clearance_key === ownClearanceKey}
              isPublicSafety={isPublicSafety}
              onSubmitAction={handleClearanceAction}
            />
          ))}
        </div>
      </section>

      {/* Activity timeline — fetched on demand */}
      <section className="app-detail__section">
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => setShowActivity((prev) => !prev)}
        >
          {showActivity ? 'Hide Activity' : 'View Activity'}
        </button>
        {showActivity && <ReviewActivity applicationId={id} />}
      </section>

    </div>
  )
}

const QUEUE_FILTERS = [
  { value: 'all',       label: 'All' },
  { value: 'ready',     label: 'Ready' },
  { value: 'locked',    label: 'Locked' },
  { value: 'completed', label: 'Completed' },
]

/* -------------------------------------------------------
   AdminDashboard — main page component

   Office identity comes from the backend session (App.jsx), and the
   queue itself is already scoped server-side to the caller's own
   office — this page never fetches or shows another office's queue.
------------------------------------------------------- */
function AdminDashboard({ onNavigate, currentSession }) {
  const [queue, setQueue]                             = useState([])
  const [queueLoading, setQueueLoading]                 = useState(true)
  const [queueError, setQueueError]                   = useState('')
  const [filter, setFilter]                           = useState('all')
  const [selectedApplicationId, setSelectedApplicationId] = useState(null)

  const officeRole      = currentSession?.role_name || null
  const ownClearanceKey = getOwnClearanceKey(currentSession?.role_key)
  const isPublicSafety  = currentSession?.role_key === 'public_safety'
  const isAdmin         = currentSession?.account_type === 'admin'

  // GET /officials/me/queue is official-only — a system_admin account
  // gets a 403 (not an empty list) if it calls this, so admins simply
  // never make the request and see an explanatory message instead.
  const loadQueue = useCallback(() => {
    if (isAdmin) {
      setQueueLoading(false)
      return
    }
    setQueueLoading(true)
    setQueueError('')
    getOfficialQueue(filter === 'all' ? undefined : { availability: filter })
      .then(setQueue)
      .catch((err) => setQueueError(err.message))
      .finally(() => setQueueLoading(false))
  }, [filter, isAdmin])

  useEffect(() => { loadQueue() }, [loadQueue])

  const handleReview = (applicationId) => {
    setSelectedApplicationId(applicationId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Brief loading gate — App.jsx already guards this route.
  if (!officeRole) return null

  return (
    <div className="admin-dashboard">

      {/* Page header */}
      <div className="admin-header">
        <div>
          <p className="admin-header__eyebrow">Registrar Workflow</p>
          <h1 className="admin-header__title">Admin Dashboard</h1>
          <p className="admin-header__desc">
            Review and process student registration applications.
          </p>
        </div>
        <button type="button" className="btn btn--outline" onClick={() => onNavigate('home')}>
          ← Back to Home
        </button>
      </div>

      {/* Role banner — shows which office is currently logged in */}
      <RoleBanner officeRole={officeRole} />

      {/* Application review panel — shown when a queue row is opened */}
      {selectedApplicationId && (
        <ReviewPanel
          applicationId={selectedApplicationId}
          ownClearanceKey={ownClearanceKey}
          isPublicSafety={isPublicSafety}
          onClose={() => setSelectedApplicationId(null)}
          onQueueChanged={loadQueue}
        />
      )}

      {/* Office queue — system_admin accounts don't have one (see loadQueue) */}
      <section className="applications-section">
        <div className="applications-section__heading-row">
          <h2 className="applications-section__heading">
            {isAdmin ? 'Office Queue' : `${officeRole} Queue`}
          </h2>
          {!isAdmin && (
            <span className="applications-section__count">
              {queue.length} {queue.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {!isAdmin && (
          <div className="queue-filter-tabs">
            {QUEUE_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`queue-filter-tab${filter === option.value ? ' queue-filter-tab--active' : ''}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {queueLoading ? (
          <p className="portal-loading">Loading your queue…</p>
        ) : queueError ? (
          <div className="admin-empty">
            <p className="admin-empty__text">We couldn't load your queue.</p>
            <p className="admin-empty__hint">{queueError}</p>
            <button type="button" className="btn btn--primary" onClick={loadQueue}>
              Try Again
            </button>
          </div>
        ) : queue.length === 0 ? (
          <div className="admin-empty">
            <svg className="admin-empty__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <p className="admin-empty__text">
              {isAdmin
                ? "System Admin accounts don't have an office queue — office staff review applications directly."
                : 'No applications in your queue right now.'}
            </p>
          </div>
        ) : (
          <div className="applications-table-wrap">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>App #</th>
                  <th>Student</th>
                  <th>Term</th>
                  <th>Program</th>
                  <th>Housing</th>
                  <th>Overall Status</th>
                  <th>Clearance Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const isSelected = selectedApplicationId === item.application_id
                  return (
                    <tr
                      key={item.clearance_id}
                      className={isSelected ? 'applications-table__row--selected' : ''}
                    >
                      <td className="table-app-id">{item.application_number}</td>
                      <td>
                        {item.student_name}
                        <br /><span className="table-subtext">{item.student_no}</span>
                      </td>
                      <td>
                        {item.term_code}
                        <br /><span className="table-subtext">{item.academic_year}</span>
                      </td>
                      <td>
                        {item.major || '—'}
                        <br /><span className="table-subtext">{item.classification || '—'}</span>
                      </td>
                      <td>{item.housing_required ? 'Yes' : 'No'}</td>
                      <td><StatusBadge status={formatOverallStatus(item.overall_status)} /></td>
                      <td>
                        <StatusBadge status={formatClearanceStatus(item.clearance_status)} />
                        {item.blocked_reason && (
                          <p className="table-subtext table-blocked-reason">{item.blocked_reason}</p>
                        )}
                      </td>
                      <td className="table-submitted-at">{formatDate(item.submitted_at)}</td>
                      <td>
                        <button
                          type="button"
                          className={`view-details-btn${isSelected ? ' view-details-btn--active' : ''}`}
                          onClick={() => handleReview(item.application_id)}
                        >
                          {isSelected ? 'Viewing' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

export default AdminDashboard
