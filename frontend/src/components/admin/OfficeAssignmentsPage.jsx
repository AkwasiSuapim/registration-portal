import { useEffect, useState } from 'react'
import { getOfficeAssignments, reassignOfficial, isMissingEndpoint } from '../../services/adminApi'
import { OFFICE_ROLE_OPTIONS, officeLabel } from './adminConstants'
import ConfirmDialog from '../official/ConfirmDialog'
import MissingEndpointNotice from './MissingEndpointNotice'

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
          Currently: {official.role_key ? officeLabel(official.role_key) : 'Unassigned'}.
          An official can hold only one primary office at a time.
        </p>
        <div className="admin-radio-grid" role="radiogroup" aria-label="New primary office">
          {OFFICE_ROLE_OPTIONS.filter((opt) => opt.value !== official.role_key).map((opt) => (
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
   office (GET /admin/offices), with an assign/reassign flow that
   always goes through a confirmation dialog before submitting.
------------------------------------------------------- */
function OfficeAssignmentsPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
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
      setMissing(false)
      setError('')
      try {
        const result = await getOfficeAssignments()
        if (!cancelled) setData(result)
      } catch (err) {
        if (cancelled) return
        if (isMissingEndpoint(err)) setMissing(true)
        else setError(err.message)
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
      await reassignOfficial(official.id, newOffice)
      setSuccessMessage(`${official.name} was assigned to ${officeLabel(newOffice)}.`)
      setPendingChange(null)
      load()
    } catch (err) {
      setActionError(
        isMissingEndpoint(err)
          ? 'This action is not available yet — the backend does not support office reassignment (PATCH /admin/officials/{id}/office).'
          : err.message
      )
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
        ) : missing ? (
          <MissingEndpointNotice endpoint="GET /admin/offices" onRetry={load} />
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
          <>
            <div className="admin-office-assign-grid">
              {OFFICE_ROLE_OPTIONS.map((office) => {
                const group = data?.offices?.find((o) => o.role_key === office.value)
                const officials = group?.officials || []
                return (
                  <div key={office.value} className="admin-office-assign-card">
                    <div className="admin-office-assign-card__head">
                      <span className="admin-office-assign-card__name">{office.label}</span>
                      <span className="admin-office-assign-card__count">{officials.length}</span>
                    </div>
                    {officials.length === 0 ? (
                      <p className="official-empty-inline">No officials assigned.</p>
                    ) : (
                      officials.map((official) => (
                        <div key={official.id} className="admin-official-row">
                          <span>
                            <span className="admin-official-row__name">{official.name}</span>
                            <span className="admin-official-row__email">{official.email}</span>
                          </span>
                          <button
                            type="button"
                            className="btn btn--outline btn--small"
                            onClick={() => setPicking({ ...official, role_key: office.value })}
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

            <section aria-labelledby="admin-unassigned-h">
              <h3 id="admin-unassigned-h" className="workspace-card__title">Unassigned Officials</h3>
              {(data?.unassigned || []).length === 0 ? (
                <p className="official-empty-inline">No unassigned officials.</p>
              ) : (
                <div className="admin-office-assign-card">
                  {data.unassigned.map((official) => (
                    <div key={official.id} className="admin-official-row">
                      <span>
                        <span className="admin-official-row__name">{official.name}</span>
                        <span className="admin-official-row__email">{official.email}</span>
                      </span>
                      <button type="button" className="btn btn--outline btn--small" onClick={() => setPicking(official)}>
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
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
          body={`Assign ${pendingChange.official.name} to ${officeLabel(pendingChange.newOffice)}? This changes which queue their applications appear in immediately.`}
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
