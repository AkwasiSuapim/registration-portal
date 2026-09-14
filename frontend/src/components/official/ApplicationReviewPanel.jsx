import { useCallback, useEffect, useState } from 'react'
import { getApplicationReview, updateClearance, getApplicationActivity } from '../../services/api'
import { formatOverallStatus, formatClearanceStatus } from '../../utils/backendLabels'
import StatusBadge from '../StatusBadge'
import DocumentList from '../DocumentList'
import ActivityTimeline from '../ActivityTimeline'
import ConfirmDialog from './ConfirmDialog'
import { formatDateTime } from './officialStatus'
import { getDraft, saveDraft, clearDraft } from '../../services/officialLocalState'

const ACTION_META = {
  approve:                 { label: 'Approve',                  confirmVerb: 'approve this clearance',            tone: 'primary' },
  request_correction:      { label: 'Request Correction',       confirmVerb: 'request a correction from the student', tone: 'primary' },
  reject:                  { label: 'Reject',                   confirmVerb: 'reject this clearance',             tone: 'danger'  },
  mark_in_person_required: { label: 'Require In-Person Visit',  confirmVerb: 'require an in-person visit',        tone: 'primary' },
}

/* -------------------------------------------------------
   ClearanceActionBlock — one clearance in the review panel.

   Officials only ever see action buttons for the one clearance their
   office role owns (canAct) — but that is UX convenience only. The
   backend independently re-checks role ownership on every
   PATCH /clearances/{id} call (can_role_update_clearance, 403 on
   mismatch) and rejects a stale/locked/finalized clearance with 409 —
   see clearance_service.update_clearance_status. This block just
   mirrors what the server will already refuse to do.
------------------------------------------------------- */
function ClearanceActionBlock({ clearance, canAct, isPublicSafety, officialUserId, onSubmitAction, onActionSuccess }) {
  const [message, setMessage]         = useState(() => getDraft(officialUserId, clearance.id)?.comment || '')
  const [submitting, setSubmitting]   = useState(false)
  const [actionError, setActionError] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState(() => getDraft(officialUserId, clearance.id)?.savedAt || null)
  const [pendingAction, setPendingAction] = useState(null) // action key awaiting confirmation

  const displayStatus = formatClearanceStatus(clearance.status)
  const showActions   = canAct && clearance.availability === 'ready'

  const requestAction = (action) => {
    if ((action === 'request_correction' || action === 'reject') && !message.trim()) {
      setActionError('Please enter a message explaining why.')
      return
    }
    setActionError('')
    setPendingAction(action)
  }

  const handleSaveDraft = () => {
    saveDraft(officialUserId, clearance.id, message)
    setDraftSavedAt(new Date().toISOString())
  }

  const handleConfirm = async () => {
    const action = pendingAction
    setSubmitting(true)
    setActionError('')
    try {
      await onSubmitAction(clearance.id, action, message.trim() || null)
      clearDraft(officialUserId, clearance.id)
      setDraftSavedAt(null)
      setPendingAction(null)
      onActionSuccess(ACTION_META[action].label)
    } catch (err) {
      // Backend is authoritative here — surface its message verbatim
      // (wrong office = 403, locked/finalized clearance = 409, missing message = 422, etc).
      setActionError(err.message || 'Could not update this clearance.')
      setPendingAction(null)
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
          <span>Last decision recorded {formatDateTime(clearance.reviewed_at)}</span>
        </div>
      )}

      {clearance.availability === 'locked' && clearance.blocked_reason && (
        <p className="clearance-section__message">{clearance.blocked_reason}</p>
      )}

      {clearance.message && (
        <p className="clearance-section__message">{clearance.message}</p>
      )}

      {showActions && (
        <div className="clearance-section__actions">
          <label className="official-comment-label" htmlFor={`comment-${clearance.id}`}>
            Official comment
          </label>
          <textarea
            id={`comment-${clearance.id}`}
            className="clearance-section__textarea"
            placeholder="Message (required for Request Correction / Reject — shown to the student)…"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            disabled={submitting}
          />

          {draftSavedAt && (
            <p className="official-notice official-notice--inline">
              Draft saved on this device at {formatDateTime(draftSavedAt)} — not sent to the
              server (there is no draft-review endpoint yet).
            </p>
          )}
          {actionError && <p className="clearance-section__error">{actionError}</p>}

          <div className="clearance-section__buttons">
            <button
              type="button"
              className="btn btn--outline"
              disabled={submitting}
              onClick={handleSaveDraft}
            >
              Save Review as Draft
            </button>
            <button
              type="button"
              className="status-action-btn status-action-btn--approved"
              disabled={submitting}
              onClick={() => requestAction('approve')}
            >
              Approve
            </button>
            <button
              type="button"
              className="status-action-btn status-action-btn--correction-required"
              disabled={submitting}
              onClick={() => requestAction('request_correction')}
            >
              Request Correction
            </button>
            <button
              type="button"
              className="status-action-btn status-action-btn--rejected"
              disabled={submitting}
              onClick={() => requestAction('reject')}
            >
              Reject
            </button>
            {isPublicSafety && (
              <button
                type="button"
                className="status-action-btn status-action-btn--in-person-required"
                disabled={submitting}
                onClick={() => requestAction('mark_in_person_required')}
              >
                Require In-Person Visit
              </button>
            )}
          </div>
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={`${ACTION_META[pendingAction].label}?`}
          body={`This will ${ACTION_META[pendingAction].confirmVerb} for ${clearance.clearance_label} and notify the student. This cannot be undone from this screen.`}
          confirmLabel={ACTION_META[pendingAction].label}
          tone={ACTION_META[pendingAction].tone}
          submitting={submitting}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------
   ReviewActivity — GET /applications/{id}/activity, shown on demand.
   Also doubles as the "previous decisions" record — every clearance
   action appears here with its before/after status.
------------------------------------------------------- */
function ReviewActivity({ applicationId }) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activity, setActivity] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await getApplicationActivity(applicationId)
        if (!cancelled) setActivity(result.activity)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [applicationId])

  if (loading) return <p className="app-detail__empty">Loading activity…</p>
  if (error) return <p className="app-detail__empty">{error}</p>
  return <ActivityTimeline activity={activity} />
}

/* -------------------------------------------------------
   ApplicationReviewPanel — full review for one application
   (GET /applications/{id}/review).
------------------------------------------------------- */
function ApplicationReviewPanel({ applicationId, currentSession, ownClearanceKey, isPublicSafety, onClose, onQueueChanged }) {
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [review, setReview]             = useState(null)
  const [showActivity, setShowActivity] = useState(true)
  const [successBanner, setSuccessBanner] = useState('')

  // Shared refetch used by the retry button and after a decision is
  // recorded (handleClearanceAction below) — neither of those call
  // sites is inside a useEffect body.
  const loadReview = useCallback(() => {
    setLoading(true)
    setError('')
    getApplicationReview(applicationId)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [applicationId])

  // The initial, on-mount fetch is written inline (rather than calling
  // loadReview above) so this effect's own body never calls setState
  // directly.
  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const result = await getApplicationReview(applicationId)
        if (!cancelled) setReview(result)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [applicationId])

  const handleClearanceAction = async (clearanceId, action, message) => {
    await updateClearance(clearanceId, { action, message })
    loadReview()
    onQueueChanged()
  }

  const handleActionSuccess = (actionLabel) => {
    setSuccessBanner(`${actionLabel} recorded successfully. The student has been notified.`)
  }

  if (loading) {
    return (
      <div className="workspace-panel">
        <p className="portal-status-panel__loading">Loading application review…</p>
      </div>
    )
  }

  if (error) {
    const isPermissionDenied = error.toLowerCase().includes('permission') || error.toLowerCase().includes('not have permission')
    return (
      <div className="workspace-panel">
        <div className="workspace-error" role="alert">
          <span className="workspace-error__icon" aria-hidden="true">!</span>
          <div className="workspace-error__body">
            <span className="workspace-error__title">
              {isPermissionDenied ? 'You do not have permission to view this application' : 'We could not load this application'}
            </span>
            <p className="workspace-error__text">{error}</p>
            <div className="workspace-error__actions">
              {!isPermissionDenied && (
                <button type="button" className="btn btn--outline" onClick={loadReview}>Try again</button>
              )}
              <button type="button" className="btn btn--primary" onClick={onClose}>Back</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const {
    id, application_number, term_code, academic_year, major, classification,
    housing_required, overall_status, submitted_at, total_credit_hours,
    student, courses = [], clearances = [], documents = [],
  } = review

  return (
    <div className="workspace-panel">

      <button type="button" className="workspace-back" onClick={onClose}>
        ← Back
      </button>

      {successBanner && (
        <div className="official-success-banner" role="status">
          <span aria-hidden="true">✓</span> {successBanner}
        </div>
      )}

      <section className="workspace-card" aria-labelledby="review-student-h">
        <div className="workspace-card__head">
          <div>
            <p className="app-detail__app-id">{application_number}</p>
            <h1 id="review-student-h" className="workspace-hero__title">{student.first_name} {student.last_name}</h1>
            <div className="app-detail__overall-status">
              <span className="app-detail__overall-label">Overall Status:</span>
              <StatusBadge status={formatOverallStatus(overall_status)} />
            </div>
          </div>
        </div>

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
            <span className="app-detail__value">{formatDateTime(submitted_at)}</span>
          </div>
        </div>
      </section>

      <section className="workspace-card" aria-labelledby="review-courses-h">
        <h2 id="review-courses-h" className="workspace-card__title">
          Selected Courses
          {total_credit_hours > 0 && (
            <span className="app-detail__credit-badge">{total_credit_hours} credit hours</span>
          )}
        </h2>
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

      <section className="workspace-card" aria-labelledby="review-docs-h">
        <h2 id="review-docs-h" className="workspace-card__title">Uploaded Documents</h2>
        {documents.length === 0 && (
          <p className="official-notice">
            No documents on file for this application yet — nothing has been uploaded for this
            office to review.
          </p>
        )}
        <DocumentList documents={documents} />
        <p className="official-notice">
          Documents open for download in a new tab. The API has no field for a student to leave a
          comment on their application, so no comment thread appears here.
        </p>
      </section>

      <section className="workspace-card" aria-labelledby="review-clearances-h">
        <h2 id="review-clearances-h" className="workspace-card__title">Office Clearances</h2>
        <p className="workspace-card__subtitle">
          Only your office's clearance is editable here. Every other office is shown read-only.
        </p>
        <div className="clearance-list">
          {clearances.map((clearance) => (
            <ClearanceActionBlock
              key={clearance.id}
              clearance={clearance}
              canAct={clearance.clearance_key === ownClearanceKey}
              isPublicSafety={isPublicSafety}
              officialUserId={currentSession?.id}
              onSubmitAction={handleClearanceAction}
              onActionSuccess={handleActionSuccess}
            />
          ))}
        </div>
      </section>

      <section className="workspace-card" aria-labelledby="review-activity-h">
        <div className="workspace-card__head">
          <h2 id="review-activity-h" className="workspace-card__title">Activity &amp; Previous Decisions</h2>
          <button
            type="button"
            className="btn btn--outline btn--small"
            onClick={() => setShowActivity((prev) => !prev)}
          >
            {showActivity ? 'Hide' : 'Show'}
          </button>
        </div>
        {showActivity && <ReviewActivity applicationId={id} />}
      </section>

    </div>
  )
}

export default ApplicationReviewPanel
