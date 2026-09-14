import { useEffect, useState } from 'react'
import { listAdminUsers, reassignOfficialOffice } from '../../services/adminApi'
import { OFFICE_ROLE_OPTIONS, officeLabel } from './adminConstants'
import ConfirmDialog from '../official/ConfirmDialog'

// Large enough to cover every official account in one page — the college
// has seven offices, not seven hundred officials, so a single request is
// simpler and just as correct as adding real pagination here.
const OFFICIAL_PAGE_SIZE = 500

/* -------------------------------------------------------
   AssignmentPicker — the "pick a new primary office" step, shown
   before the confirmation dialog. A separate small modal (rather than
   folding office choice into ConfirmDialog itself) so the confirmation
   step always reads back a concrete "from X to Y" sentence.
------------------------------------------------------- */
function AssignmentPicker({ official, onCancel, onContinue }) {
  const [choice, setChoice] = useState('')
  return (
    <div className="official-modal-overlay" role="presentation">
      <div className="official-modal" role="dialog" aria-modal="true" aria-labelledby="assign-picker-title">
        <h2 id="assign-picker-title" className="official-modal__title">
          Assign {official.name} to an office
        </h2>
        <p className="official-modal__body">
          Currently: {officeLabel(official.office)}. An official can hold only one primary office at a time.
        </p>
        <div className="admin-radio-grid" role="radiogroup" aria-label="New primary office">
          {OFFICE_ROLE_OPTIONS.filter((opt) => opt.value !== official.office).map((opt) => (
            <label key={opt.value} className="admin-radio-option">
              <input
                type="radio"
                name="new-office"
                value={opt.value}
                checked={choice === opt.value}
                onChange={() => setChoice(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="official-modal__actions">
          <button type="button" className="btn btn--outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!choice} onClick={() => onContinue(choice)}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   OfficeAssignmentsPage — officials grouped by their one primary
   office. There is no dedicated "list offices" endpoint — this groups
   the results of GET /admin/users?role=official client-side, which the
   directory already returns with each official's office. Reassignment
   goes through PUT /admin/officials/{id}/office and always requires
   confirmation before submitting.
------------------------------------------------------- */
function OfficeAssignmentsPage() {
  const [officials, setOfficials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [picking, setPicking]         = useState(null) // official being (re)assigned
  const [pendingChange, setPendingChange] = useState(null) // { official, newOffice }
  const [submitting, setSubmitting]   = useState(false)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // reloadToken has no meaning beyond "changed" — the Retry button
  // bumps it to re-run the effect below without a second, separately-
  // called copy of its fetch logic.
  const [reloadToken, setReloadToken] = useState(0)
  const load = () => setReloadToken((t) => t + 1)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const result = await listAdminUsers({ role: 'official', page_size: OFFICIAL_PAGE_SIZE })
        if (!cancelled) setOfficials(result.items || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [reloadToken])

  const handleConfirmReassign = async () => {
    const { official, newOffice } = pendingChange
    setSubmitting(true)
    setActionError('')
    try {
      await reassignOfficialOffice(official.id, newOffice)
      setSuccessMessage(`${official.first_name} ${official.last_name} was assigned to ${officeLabel(newOffice)}.`)
      setPendingChange(null)
      load()
    } catch (err) {
      setActionError(err.message)
      setPendingChange(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="workspace-panel">
      <div>
        <h1 className="workspace-hero__title">Office Assignments</h1>
        <p className="workspace-hero__subtitle">
          Officials grouped by their one primary office. Reassigning an official always requires confirmation.
        </p>
      </div>

      {successMessage && (
        <div className="official-success-banner" role="status">
          <span aria-hidden="true">✓</span> {successMessage}
        </div>
      )}
      {actionError && <p className="admin-field-error" role="alert">{actionError}</p>}

      <section className="workspace-card">
        {loading ? (
          <p className="app-detail__empty">Loading office assignments…</p>
        ) : error ? (
          <div className="workspace-error" role="alert">
            <span className="workspace-error__icon" aria-hidden="true">!</span>
            <div className="workspace-error__body">
              <span className="workspace-error__title">Could not load office assignments</span>
              <p className="workspace-error__text">{error}</p>
              <div className="workspace-error__actions">
                <button type="button" className="btn btn--outline" onClick={load}>Try again</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-office-assign-grid">
            {OFFICE_ROLE_OPTIONS.map((office) => {
              const group = officials.filter((o) => o.office === office.value)
              return (
                <div key={office.value} className="admin-office-assign-card">
                  <div className="admin-office-assign-card__head">
                    <span className="admin-office-assign-card__name">{office.label}</span>
                    <span className="admin-office-assign-card__count">{group.length}</span>
                  </div>
                  {group.length === 0 ? (
                    <p className="official-empty-inline">No officials assigned.</p>
                  ) : (
                    group.map((official) => (
                      <div key={official.id} className="admin-official-row">
                        <span>
                          <span className="admin-official-row__name">{official.first_name} {official.last_name}</span>
                          <span className="admin-official-row__email">{official.email}</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn--outline btn--small"
                          onClick={() => setPicking(official)}
                        >
                          Change
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {picking && (
        <AssignmentPicker
          official={picking}
          onCancel={() => setPicking(null)}
          onContinue={(newOffice) => {
            setPendingChange({ official: picking, newOffice })
            setPicking(null)
          }}
        />
      )}

      {pendingChange && (
        <ConfirmDialog
          title="Confirm office assignment"
          body={`Assign ${pendingChange.official.first_name} ${pendingChange.official.last_name} to ${officeLabel(pendingChange.newOffice)}? This changes which queue their applications appear in immediately.`}
          confirmLabel="Confirm Assignment"
          tone="primary"
          submitting={submitting}
          onConfirm={handleConfirmReassign}
          onCancel={() => setPendingChange(null)}
        />
      )}
    </div>
  )
}

export default OfficeAssignmentsPage
