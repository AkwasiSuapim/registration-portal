import { useParams } from 'react-router-dom'
import ApplicationReviewPanel from '../official/ApplicationReviewPanel'

/* -------------------------------------------------------
   StudentRecordPage — the admin "Student Record" screen.

   Reuses ApplicationReviewPanel unchanged (same component the Official
   Workspace uses for GET /applications/{id}/review) rather than
   building a second copy of the same student profile / clearance /
   documents / activity view — it already covers every real-data part
   of the spec: student profile, current registration status, all
   seven office clearances, submitted documents, and activity history.

   Read-only guarantee: ApplicationReviewPanel only renders clearance
   action buttons when a clearance's clearance_key matches
   ownClearanceKey. Admin accounts have no office clearance key, so
   passing ownClearanceKey={null} means canAct is false for every
   clearance — administrators can view every decision here but cannot
   overwrite one, exactly as required.

   Two things a full "Student Record" needs that this backend cannot
   provide yet are called out explicitly rather than guessed at:
     - Account Information (is_active / created_at / last_login_at)
       — not on ApplicationReviewResponse.student; needs
       GET /admin/students/{id}.
     - Registration History across multiple terms — only the one
       application linked in from here is available; listing every
       term a student has registered for needs
       GET /admin/students/{id}/applications.
------------------------------------------------------- */
function StudentRecordPage({ onNavigate, currentSession }) {
  const { applicationId } = useParams()

  return (
    <div className="workspace-panel">
      <ApplicationReviewPanel
        applicationId={applicationId}
        currentSession={currentSession}
        ownClearanceKey={null}
        isPublicSafety={false}
        onClose={() => onNavigate('/admin/users')}
        onQueueChanged={() => {}}
      />

      <section className="workspace-card" aria-labelledby="admin-account-info-h">
        <h2 id="admin-account-info-h" className="workspace-card__title">Account Information</h2>
        <p className="admin-form-note">
          Account status, account creation date, and last login are stored on the student's user
          record, which this review endpoint does not return. Showing them here requires
          GET /admin/students/{'{id}'} — see the implementation report.
        </p>
      </section>

      <section className="workspace-card" aria-labelledby="admin-reg-history-h">
        <h2 id="admin-reg-history-h" className="workspace-card__title">Registration History</h2>
        <p className="admin-form-note">
          Only the registration linked in from Recent Activity or User Management is shown above.
          Listing every term this student has registered for requires
          GET /admin/students/{'{id}'}/applications — see the implementation report.
        </p>
      </section>
    </div>
  )
}

export default StudentRecordPage
