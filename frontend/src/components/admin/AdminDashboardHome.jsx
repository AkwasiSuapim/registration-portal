import { useEffect, useState } from 'react'
import { getAdminDashboardSummary } from '../../services/adminApi'
import { formatAction, formatOverallStatus } from '../../utils/backendLabels'
import { officeLabel } from './adminConstants'
import StatusBadge from '../StatusBadge'

function formatDateTime(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const SUMMARY_CARD_DEFS = [
  { key: 'total_students',             label: 'Total Students' },
  { key: 'active_officials',           label: 'Active Officials' },
  { key: 'registrations_in_progress',  label: 'Registrations In Progress' },
  { key: 'completed_registrations',    label: 'Completed Registrations' },
  { key: 'blocked_applications',       label: 'Blocked Applications' },
  { key: 'pending_clearances',         label: 'Pending Clearances' },
]

/* -------------------------------------------------------
   AdminDashboardHome — the Admin Workspace landing screen.

   Everything here comes from one real, database-backed call —
   GET /admin/dashboard/summary — which returns the six summary counts,
   registration progress by office, recent activity, and applications
   requiring attention in a single response (see
   backend/app/services/admin_service.py get_dashboard_summary).
------------------------------------------------------- */
function AdminDashboardHome({ onNavigate }) {
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  // reloadToken has no meaning beyond "changed" — the Retry button bumps
  // it to re-run the effect below without a second, separately-called
  // copy of the fetch logic.
  const [reloadToken, setReloadToken] = useState(0)
  const reload = () => setReloadToken((t) => t + 1)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const result = await getAdminDashboardSummary()
        if (!cancelled) setSummary(result)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [reloadToken])

  if (loading) {
    return (
      <div className="workspace-panel">
        <p className="app-detail__empty">Loading dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="workspace-panel">
        <div className="workspace-error" role="alert">
          <span className="workspace-error__icon" aria-hidden="true">!</span>
          <div className="workspace-error__body">
            <span className="workspace-error__title">Could not load the dashboard</span>
            <p className="workspace-error__text">{error}</p>
            <div className="workspace-error__actions">
              <button type="button" className="btn btn--outline" onClick={reload}>Try again</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const recentActivity = summary.recent_activity || []
  const attentionItems = summary.applications_requiring_attention || []

  return (
    <div className="workspace-panel">

      {/* Summary cards */}
      <section className="workspace-card" aria-labelledby="admin-summary-h">
        <h2 id="admin-summary-h" className="workspace-card__title">Overview</h2>
        <div className="admin-summary-grid">
          {SUMMARY_CARD_DEFS.map((def) => (
            <div key={def.key} className="admin-summary-card">
              <span className="admin-summary-card__value">{summary[def.key] ?? '—'}</span>
              <span className="admin-summary-card__label">{def.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Registration progress by office */}
      <section className="workspace-card" aria-labelledby="admin-progress-h">
        <h2 id="admin-progress-h" className="workspace-card__title">Registration Progress by Office</h2>
        {!summary.registration_progress_by_office?.length ? (
          <p className="app-detail__empty">No registration activity recorded yet.</p>
        ) : (
          <div className="admin-office-progress-list">
            {summary.registration_progress_by_office.map((row) => {
              const total = (row.ready || 0) + (row.pending || 0) + (row.completed || 0)
              const pct = total > 0 ? Math.round((row.completed / total) * 100) : 0
              return (
                <div key={row.role_key} className="admin-office-progress">
                  <div className="admin-office-progress__head">
                    <span>{row.role_name || officeLabel(row.office)}</span>
                    <span className="admin-office-progress__meta">{row.completed}/{total} completed</span>
                  </div>
                  <div className="workspace-progress-bar">
                    <div className="workspace-progress-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent activity + applications requiring attention */}
      <div className="admin-two-col">
        <section className="workspace-card" aria-labelledby="admin-activity-h">
          <h2 id="admin-activity-h" className="workspace-card__title">Recent Activity</h2>
          <p className="workspace-card__subtitle">
            The most recent logged application/clearance events across every office.
          </p>
          {recentActivity.length === 0 ? (
            <p className="app-detail__empty">No activity recorded yet.</p>
          ) : (
            <ul className="admin-activity-list">
              {recentActivity.map((log) => (
                <li key={log.id}>
                  {log.application_id ? (
                    <button
                      type="button"
                      className="admin-activity-row admin-activity-row--link"
                      onClick={() => onNavigate(`/admin/records/${log.application_id}`)}
                    >
                      <span className="admin-activity-row__main">
                        <span className="admin-activity-row__action">{formatAction(log.action)}</span>
                        <span className="admin-activity-row__meta">
                          {log.student_name ? `${log.student_name} · ` : ''}
                          {log.success ? 'Succeeded' : 'Did not succeed'}
                        </span>
                      </span>
                      <span className="admin-activity-row__time">{formatDateTime(log.occurred_at)}</span>
                    </button>
                  ) : (
                    <div className="admin-activity-row">
                      <span className="admin-activity-row__main">
                        <span className="admin-activity-row__action">{formatAction(log.action)}</span>
                        <span className="admin-activity-row__meta">{log.success ? 'Succeeded' : 'Did not succeed'}</span>
                      </span>
                      <span className="admin-activity-row__time">{formatDateTime(log.occurred_at)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="workspace-card" aria-labelledby="admin-attention-h">
          <h2 id="admin-attention-h" className="workspace-card__title">Applications Requiring Attention</h2>
          <p className="workspace-card__subtitle">
            Applications currently rejected or awaiting a student correction.
          </p>
          {attentionItems.length === 0 ? (
            <p className="app-detail__empty">Nothing requires attention right now.</p>
          ) : (
            <ul className="admin-activity-list">
              {attentionItems.map((item) => (
                <li key={item.application_id}>
                  <button
                    type="button"
                    className="admin-activity-row admin-activity-row--link"
                    onClick={() => onNavigate(`/admin/records/${item.application_id}`)}
                  >
                    <span className="admin-activity-row__main">
                      <span className="admin-activity-row__action">{item.student_name}</span>
                      <span className="admin-activity-row__meta">
                        {item.application_number} · <StatusBadge status={formatOverallStatus(item.overall_status)} />
                      </span>
                    </span>
                    <span className="admin-activity-row__time">{formatDateTime(item.updated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* User-management shortcuts */}
      <section className="workspace-card" aria-labelledby="admin-shortcuts-h">
        <h2 id="admin-shortcuts-h" className="workspace-card__title">User Management</h2>
        <div className="admin-shortcut-grid">
          <button type="button" className="admin-shortcut" onClick={() => onNavigate('/admin/users')}>
            <span className="admin-shortcut__label">Manage Users</span>
            <span className="admin-shortcut__desc">Search, filter, and update student &amp; official accounts.</span>
          </button>
          <button type="button" className="admin-shortcut" onClick={() => onNavigate('/admin/users/new-student')}>
            <span className="admin-shortcut__label">Add Student</span>
            <span className="admin-shortcut__desc">Create a new student account.</span>
          </button>
          <button type="button" className="admin-shortcut" onClick={() => onNavigate('/admin/users/new-official')}>
            <span className="admin-shortcut__label">Add Official</span>
            <span className="admin-shortcut__desc">Create a new office-staff account.</span>
          </button>
          <button type="button" className="admin-shortcut" onClick={() => onNavigate('/admin/offices')}>
            <span className="admin-shortcut__label">Office Assignments</span>
            <span className="admin-shortcut__desc">View and reassign each official's primary office.</span>
          </button>
        </div>
      </section>
    </div>
  )
}

export default AdminDashboardHome
