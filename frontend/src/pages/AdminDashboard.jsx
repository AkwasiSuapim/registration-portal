import { useState, useEffect } from 'react'
import {
  CLEARANCE_KEYS,
  OFFICE_ROLES,
  getClearanceLabel,
  getAllowedClearanceKey,
  calculateOverallStatus,
  loadApplications,
  saveApplications,
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
   Helper — CSS slug for a status string
   "Correction Required" → "correction-required"
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
   RoleSelector — shown when no office session is active.
   Clicking a role stores it in localStorage and updates state.
------------------------------------------------------- */
function RoleSelector({ onSelect }) {
  return (
    <div className="role-selector">
      <div className="role-selector__header">
        <h2 className="role-selector__title">Select Your Office Role</h2>
        <p className="role-selector__desc">
          Choose your office to begin reviewing student applications.
          Each office can only update its own assigned clearance section.
        </p>
      </div>
      <div className="role-selector__grid">
        {OFFICE_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className="role-card"
            onClick={() => onSelect(role)}
          >
            <span className="role-card__name">{role}</span>
            <span className="role-card__clearance">
              {getClearanceLabel(getAllowedClearanceKey(role))}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   RoleBanner — shown at the top when a session is active
------------------------------------------------------- */
function RoleBanner({ officeRole, onLogout }) {
  const clearanceLabel = getClearanceLabel(getAllowedClearanceKey(officeRole))
  return (
    <div className="role-banner">
      <div className="role-banner__info">
        <span className="role-banner__label">Logged in as</span>
        <span className="role-banner__role">{officeRole}</span>
        <span className="role-banner__owns">
          Managing: <strong>{clearanceLabel}</strong>
        </span>
      </div>
      <button
        type="button"
        className="btn btn--outline role-banner__logout"
        onClick={onLogout}
      >
        Switch Role
      </button>
    </div>
  )
}

/* -------------------------------------------------------
   SummaryCard — one stat card for the dashboard header
------------------------------------------------------- */
function SummaryCard({ label, count, variant }) {
  return (
    <div className={`summary-card summary-card--${variant}`}>
      <span className="summary-card__count">{count}</span>
      <span className="summary-card__label">{label}</span>
    </div>
  )
}

/* -------------------------------------------------------
   ClearanceSection — renders one clearance block.
   Only the logged-in official's assigned section shows action buttons.
   All other sections are shown as view-only.
------------------------------------------------------- */
function ClearanceSection({ clearanceKey, clearance, isAssigned, reviewMessage, onMessageChange, onAction }) {
  const label  = getClearanceLabel(clearanceKey)
  const status = clearance?.status || 'Pending'
  const canAct = isAssigned

  return (
    <div className={`clearance-section${canAct ? ' clearance-section--assigned' : ' clearance-section--readonly'}`}>
      <div className="clearance-section__header">
        <div className="clearance-section__title-row">
          <span className="clearance-section__label">{label}</span>
          <StatusBadge status={status} />
        </div>
        {!canAct && (
          <span className="clearance-section__viewonly">
            View only — assigned to another office.
          </span>
        )}
      </div>

      {/* Show reviewer info if this clearance has been acted on */}
      {clearance?.reviewedBy && (
        <div className="clearance-section__meta">
          <span>Reviewed by: <strong>{clearance.reviewedBy}</strong></span>
          <span>on {formatDate(clearance.reviewedAt)}</span>
        </div>
      )}

      {/* Show any message left by the reviewing office */}
      {clearance?.message && (
        <p className="clearance-section__message">{clearance.message}</p>
      )}

      {/* Action area — only shown for the assigned clearance */}
      {canAct && (
        <div className="clearance-section__actions">
          {/* Registrar gets a soft reminder when other clearances are still pending */}
          {clearanceKey === 'registrar' && status === 'Pending' && (
            <p className="clearance-section__registrar-note">
              Note: Registrar final review should usually happen after all
              office clearances are approved.
            </p>
          )}

          <textarea
            className="clearance-section__textarea"
            placeholder="Optional message (shown to the student and other reviewers)…"
            value={reviewMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={3}
          />

          <div className="clearance-section__buttons">
            <button
              type="button"
              className="status-action-btn status-action-btn--approved"
              disabled={status === 'Approved'}
              onClick={() => onAction(clearanceKey, 'Approved')}
            >
              Approve
            </button>
            <button
              type="button"
              className="status-action-btn status-action-btn--correction-required"
              disabled={status === 'Correction Required'}
              onClick={() => onAction(clearanceKey, 'Correction Required')}
            >
              Request Correction
            </button>
            <button
              type="button"
              className="status-action-btn status-action-btn--rejected"
              disabled={status === 'Rejected'}
              onClick={() => onAction(clearanceKey, 'Rejected')}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------
   ApplicationDetail — full review panel for one application
------------------------------------------------------- */
function ApplicationDetail({ application, officeRole, onClose, onClearanceUpdate }) {
  const [reviewMessage, setReviewMessage] = useState('')

  // The clearance key this logged-in official is allowed to update
  const allowedClearanceKey = getAllowedClearanceKey(officeRole)

  const {
    fullName, studentId, email, phone,
    classification, registrationTerm, major, minor,
    address, city, state, zipCode,
    emergencyContactName, emergencyRelationship, emergencyContactPhone,
    selectedCourses   = [],
    uploadedDocuments = [],
    totalCreditHours  = 0,
    submittedAt,
    clearances        = {},
    overallStatus,
  } = application

  // When the official clicks Approve / Request Correction / Reject
  const handleAction = (clearanceKey, newStatus) => {
    onClearanceUpdate(application.submittedAt, clearanceKey, newStatus, reviewMessage)
    setReviewMessage('')
  }

  return (
    <div className="app-detail">

      {/* Panel header */}
      <div className="app-detail__header">
        <div className="app-detail__header-info">
          <p className="app-detail__app-id">{formatApplicationId(submittedAt)}</p>
          <h2 className="app-detail__student-name">{fullName || '—'}</h2>
          <div className="app-detail__overall-status">
            <span className="app-detail__overall-label">Overall Status:</span>
            <StatusBadge status={overallStatus} />
          </div>
        </div>
        <button type="button" className="btn btn--outline" onClick={onClose}>
          ✕ Close Details
        </button>
      </div>

      {/* Student information */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">Student Information</h3>
        <div className="app-detail__grid">
          <div className="app-detail__field">
            <span className="app-detail__label">Application ID</span>
            <span className="app-detail__value">{formatApplicationId(submittedAt)}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Student ID</span>
            <span className="app-detail__value">{studentId || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">College Email</span>
            <span className="app-detail__value">{email || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Phone</span>
            <span className="app-detail__value">{phone || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Classification</span>
            <span className="app-detail__value">{classification || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Enrollment Term</span>
            <span className="app-detail__value">{registrationTerm || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Major</span>
            <span className="app-detail__value">{major || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Minor</span>
            <span className="app-detail__value">{minor || '—'}</span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Mailing Address</span>
            <span className="app-detail__value">
              {[address, city, state, zipCode].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Emergency Contact</span>
            <span className="app-detail__value">
              {emergencyContactName
                ? `${emergencyContactName} (${emergencyRelationship}) — ${emergencyContactPhone}`
                : '—'}
            </span>
          </div>
          <div className="app-detail__field">
            <span className="app-detail__label">Submitted At</span>
            <span className="app-detail__value">{formatDate(submittedAt)}</span>
          </div>
        </div>
      </section>

      {/* Selected courses */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">
          Selected Courses
          {totalCreditHours > 0 && (
            <span className="app-detail__credit-badge">{totalCreditHours} credit hours</span>
          )}
        </h3>
        {selectedCourses.length === 0 ? (
          <p className="app-detail__empty">No courses on record.</p>
        ) : (
          <div className="app-detail__course-list">
            <div className="app-detail__course-header">
              <span>Code</span><span>Title</span><span>Credits</span><span>Schedule</span>
            </div>
            {selectedCourses.map((course) => (
              <div key={course.id} className="app-detail__course-row">
                <span className="app-detail__course-code">{course.code}</span>
                <span className="app-detail__course-title">{course.title}</span>
                <span className="app-detail__course-credits">{course.credits}</span>
                <span className="app-detail__course-schedule">{course.schedule}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Uploaded documents */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">Uploaded Documents</h3>
        {uploadedDocuments.length === 0 ? (
          <p className="app-detail__empty">No documents on record.</p>
        ) : (
          <div className="app-detail__doc-list">
            {uploadedDocuments.map(({ documentId, fileName }) => (
              <div key={documentId} className="app-detail__doc-row">
                <svg className="app-detail__doc-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
                <div className="app-detail__doc-text">
                  <span className="app-detail__doc-name">{documentId}</span>
                  <span className="app-detail__doc-filename">{fileName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Clearance sections — one block per office */}
      <section className="app-detail__section">
        <h3 className="app-detail__section-title">Office Clearances</h3>
        <div className="clearance-list">
          {CLEARANCE_KEYS.map((key) => (
            <ClearanceSection
              key={key}
              clearanceKey={key}
              clearance={clearances[key]}
              isAssigned={key === allowedClearanceKey}
              reviewMessage={reviewMessage}
              onMessageChange={setReviewMessage}
              onAction={handleAction}
            />
          ))}
        </div>
      </section>

    </div>
  )
}

/* -------------------------------------------------------
   AdminDashboard — main page component
------------------------------------------------------- */
function AdminDashboard({ onNavigate }) {
  const [applications, setApplications]           = useState([])
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [officeRole, setOfficeRole]               = useState(null)

  // Load applications and restore session on mount
  useEffect(() => {
    const apps = loadApplications()
    setApplications(apps)

    const session = JSON.parse(localStorage.getItem('portalUserSession') || 'null')
    if (session?.role) setOfficeRole(session.role)
  }, [])

  /* ── Session management ── */

  const handleSelectRole = (role) => {
    localStorage.setItem('portalUserSession', JSON.stringify({ role }))
    setOfficeRole(role)
  }

  const handleLogout = () => {
    localStorage.removeItem('portalUserSession')
    setOfficeRole(null)
    setSelectedApplication(null)
  }

  /* ── Application selection ── */

  const handleViewDetails = (application) => {
    setSelectedApplication(application)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCloseDetails = () => {
    setSelectedApplication(null)
  }

  /* ── Clearance update ── */

  // Each office can only update the clearance assigned to its role.
  const updateClearanceStatus = (submittedAt, clearanceKey, newStatus, message) => {
    const now = new Date().toISOString()

    const updated = applications.map((app) => {
      if (app.submittedAt !== submittedAt) return app

      const updatedClearances = {
        ...app.clearances,
        [clearanceKey]: {
          ...app.clearances[clearanceKey],
          status:     newStatus,
          message:    message || '',
          reviewedBy: officeRole,
          reviewedAt: now,
        },
      }

      return {
        ...app,
        clearances:    updatedClearances,
        overallStatus: calculateOverallStatus(updatedClearances),
      }
    })

    setApplications(updated)
    saveApplications(updated)

    // Keep the detail panel open, reflecting the updated data
    const refreshed = updated.find((app) => app.submittedAt === submittedAt)
    setSelectedApplication(refreshed || null)
  }

  /* ── Summary counts ── */

  const totalCount      = applications.length
  const inProgressCount = applications.filter((a) => a.overallStatus === 'In Progress').length
  const correctionCount = applications.filter((a) => a.overallStatus === 'Correction Required').length
  const registeredCount = applications.filter((a) => a.overallStatus === 'Fully Registered').length
  const rejectedCount   = applications.filter((a) => a.overallStatus === 'Rejected').length

  /* ── Render ── */

  // If no role is selected, show the role selector screen
  if (!officeRole) {
    return (
      <div className="admin-dashboard">
        <div className="admin-header">
          <div>
            <p className="admin-header__eyebrow">Registrar Workflow</p>
            <h1 className="admin-header__title">Admin Dashboard</h1>
            <p className="admin-header__desc">
              Select your office role to begin reviewing student applications.
            </p>
          </div>
          <button type="button" className="btn btn--outline" onClick={() => onNavigate('home')}>
            ← Back to Home
          </button>
        </div>
        <RoleSelector onSelect={handleSelectRole} />
      </div>
    )
  }

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
      <RoleBanner officeRole={officeRole} onLogout={handleLogout} />

      {/* Summary cards */}
      <div className="summary-cards">
        <SummaryCard label="Total"              count={totalCount}      variant="total"      />
        <SummaryCard label="In Progress"        count={inProgressCount} variant="in-progress"/>
        <SummaryCard label="Correction Required" count={correctionCount} variant="correction" />
        <SummaryCard label="Fully Registered"   count={registeredCount} variant="registered" />
        <SummaryCard label="Rejected"           count={rejectedCount}   variant="rejected"   />
      </div>

      {/* Application detail panel — shown when a row is selected */}
      {selectedApplication && (
        <ApplicationDetail
          application={selectedApplication}
          officeRole={officeRole}
          onClose={handleCloseDetails}
          onClearanceUpdate={updateClearanceStatus}
        />
      )}

      {/* Applications table */}
      <section className="applications-section">
        <div className="applications-section__heading-row">
          <h2 className="applications-section__heading">Submitted Applications</h2>
          <span className="applications-section__count">
            {totalCount} {totalCount === 1 ? 'record' : 'records'}
          </span>
        </div>

        {applications.length === 0 ? (
          <div className="admin-empty">
            <svg className="admin-empty__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <p className="admin-empty__text">No applications submitted yet.</p>
            <p className="admin-empty__hint">
              Students who complete the registration form will appear here.
            </p>
          </div>
        ) : (
          <div className="applications-table-wrap">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>App ID</th>
                  <th>Student Name</th>
                  <th>Student ID</th>
                  <th>Classification</th>
                  <th>Term</th>
                  <th>Major</th>
                  <th>Credits</th>
                  <th>Overall Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app, index) => {
                  const isSelected = selectedApplication?.submittedAt === app.submittedAt
                  return (
                    <tr
                      key={app.submittedAt || index}
                      className={isSelected ? 'applications-table__row--selected' : ''}
                    >
                      <td className="table-app-id">{formatApplicationId(app.submittedAt)}</td>
                      <td>{app.fullName || '—'}</td>
                      <td>{app.studentId || '—'}</td>
                      <td>{app.classification || '—'}</td>
                      <td>{app.registrationTerm || '—'}</td>
                      <td>{app.major || '—'}</td>
                      <td className="table-credits">{app.totalCreditHours ?? '—'}</td>
                      <td><StatusBadge status={app.overallStatus} /></td>
                      <td>
                        <button
                          type="button"
                          className={`view-details-btn${isSelected ? ' view-details-btn--active' : ''}`}
                          onClick={() => handleViewDetails(app)}
                        >
                          {isSelected ? 'Viewing' : 'View Details'}
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
