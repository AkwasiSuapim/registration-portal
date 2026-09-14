import { useEffect, useRef } from 'react'

// Generic confirmation dialog shown before any final clearance decision
// (Approve / Request Correction / Reject / Require In-Person Visit) is
// submitted — the action only fires from onConfirm, never on the
// original button click, so a decision can't be sent by accident.
function ConfirmDialog({ title, body, confirmLabel, tone = 'primary', onConfirm, onCancel, submitting }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, submitting])

  return (
    <div className="official-modal-overlay" role="presentation">
      <div
        className="official-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="official-confirm-title"
        aria-describedby="official-confirm-body"
        ref={dialogRef}
        tabIndex={-1}
      >
        <h2 id="official-confirm-title" className="official-modal__title">{title}</h2>
        <p id="official-confirm-body" className="official-modal__body">{body}</p>
        <div className="official-modal__actions">
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--dark' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
