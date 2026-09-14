import { useEffect, useRef, useState } from 'react'

/* -------------------------------------------------------
   SubmissionModal — shown once after a successful POST /applications.

   Public Safety / Student ID processing happens in person and is not
   one of the seven online steps, so this modal is the one place that
   tells the student about it. The same instruction stays visible on
   the dashboard afterward (see the Overview tab's Public Safety
   notice in StudentPortal.jsx) so dismissing this modal never loses it.
------------------------------------------------------- */
function SubmissionModal({ applicationNumber, documentFailureCount, onReturnToDashboard }) {
  const [showInstructions, setShowInstructions] = useState(false)
  const dialogRef = useRef(null)
  const titleId = 'submission-modal-title'

  useEffect(() => {
    dialogRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onReturnToDashboard()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onReturnToDashboard])

  return (
    <div className="reg-modal-overlay" role="presentation">
      <div
        className="reg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <span className="reg-modal__icon" aria-hidden="true">✓</span>
        <h2 id={titleId} className="reg-modal__title">Online registration submitted.</h2>

        {applicationNumber && (
          <p className="reg-modal__meta">Application {applicationNumber} is now with the Registrar.</p>
        )}

        <p className="reg-modal__body">
          One step still requires an in-person visit: bring a valid photo ID to the{' '}
          <strong>Public Safety Office</strong> to have your Student ID processed. Public Safety
          is not an online form — it will show as <strong>“In-person action required”</strong>{' '}
          in your Clearance Tracker until an authorized official completes it there.
        </p>

        {documentFailureCount > 0 && (
          <p className="reg-modal__warning" role="alert">
            {documentFailureCount} document{documentFailureCount === 1 ? '' : 's'} did not finish
            uploading. Your registration was still submitted — finish those uploads from the
            Documents tab.
          </p>
        )}

        {showInstructions && (
          <div className="reg-modal__instructions">
            <h3 className="reg-modal__instructions-title">Visiting Public Safety</h3>
            <ul>
              <li>Bring a government-issued or current student photo ID.</li>
              <li>Public Safety processes Student IDs in person only — there is no online form for this step.</li>
              <li>Your Clearance Tracker will update automatically once an official completes this step.</li>
            </ul>
          </div>
        )}

        <div className="reg-modal__actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => setShowInstructions((v) => !v)}
            aria-expanded={showInstructions}
          >
            {showInstructions ? 'Hide Instructions' : 'View Instructions'}
          </button>
          <button type="button" className="btn btn--primary" onClick={onReturnToDashboard}>
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubmissionModal
