import { useEffect, useState } from 'react'
import { getAdminAuditLogs } from '../../services/api'
import { getAdminDashboardSummary, isMissingEndpoint } from '../../services/adminApi'
import { formatAction } from '../../utils/backendLabels'
import { officeLabel } from './adminConstants'
import MissingEndpointNotice from './MissingEndpointNotice'

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

// Audit actions that indicate an application needs administrator
// attention — a correction was requested or a clearance was rejected.
// This is real data (every entry comes straight from GET
// /admin/audit-logs), just reinterpreted client-side rather than
// coming from a purpose-built "applications requiring attention"
// endpoint — see the "requires attention" panel's own note below.
const ATTENTION_ACTIONS = new Set(['clearance_request_correction', 'clearance_reject'])

/* -------------------------------------------------------
   AdminDashboardHome — the Admin Workspace landing screen.

   Two independent data sources, loaded and error-handled separately:
     1. getAdminDashboardSummary() — MISSING backend endpoint. Powers
        the six summary cards and registration-progress-by-office.
     2. getAdminAuditLogs()        — real, admin-only endpoint. Powers
        Recent Activity and (derived client-side) Applications
        Requiring Attention.
------------------------------------------------------- */
function AdminDashboardHome({ onNavigate }) {
  const [summary, setSummary]           = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryMissing, setSummaryMissing] = useState(false)
  const [summaryError, setSummaryError]     = useState('')

  const [logs, setLogs]                 = useState([])
  const [logsLoading, setLogsLoading]   = useState(true)
  const [logsError, setLogsError]       = useState('')

  // reloadToken/logsReloadToken have no meaning beyond "changed" — each
  // Retry button bumps its token to re-run the matching effect below
  // without a second, separately-called copy of its fetch logic.
  const [summaryReloadToken, setSummaryReloadToken] = useState(0)
  const [logsReloadToken, setLogsReloadToken]       = useState(0)
  const loadSummary = () => setSummaryReloadToken((t) => t + 1)
  const loadLogs     = () => setLogsReloadToken((t) => t + 1)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setSummaryLoading(true)
      setSummaryMissing(false)
      setSummaryError('')
      try {
        const result = await getAdminDashboardSummary()
        if (!cancelled) setSummary(result)
      } catch (err) {
        if (cancelled) return
        if (isMissingEndpoint(err)) setSummaryMissing(true)
        else setSummaryError(err.message)
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [summaryReloadToken])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLogsLoading(true)
      setLogsError('')
      try {
        const result = await getAdminAuditLogs({ limit: 50 })
        if (!cancelled) setLogs(result)
      } catch (err) {
        if (!cancelled) setLogsError(err.message)
      } finally {
        if (!cancelled) setLogsLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [logsReloadToken])

  const recentActivity = logs.slice(0, 8)
  const attentionMap = new Map()
  for (const log of logs) {
    if (!log.application_id || !ATTENTION_ACTIONS.has(log.action) || !log.success) continue
    if (!attentionMap.has(log.application_id)) attentionMap.set(log.application_id, log)
  }
  const attentionItems = Array.from(attentionMap.values()).slice(0, 8)

  return (
    <div className="workspace-panel">

      {/* Summary cards */}
      <section className="workspace-card" aria-labelledby="admin-summary-h">
        <h2 id="admin-summary-h" className="workspace-card__title">Overview</h2>
        {summaryLoading ? (
          <p className="app-detail__empty">Loading dashboard summary…</p>
        ) : summaryMissing ? (
          <MissingEndpointNotice endpoint="GET /admin/dashboard/summary" onRetry={loadSummary} />
        ) : summaryError ? (
          <div className="workspace-error" role="alert">
            <span className="workspace-error__icon" aria-hidden="true">!</span>
            <div className="workspace-error__body">
              <span className="workspace-error__title">Could not load the dashboard summary</span>
              <p className="workspace-error__text">{summaryError}</p>
              <div className="workspace-error__actions">
                <button type="button" className="btn btn--outline" onClick={loadSummary}>Try again</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-summary-grid">
            {SUMMARY_CARD_DEFS.map((def) => (
              <div key={def.key} className="admin-summary-card">
                <span className="admin-summary-card__value">{summary?.[def.key] ?? '—'}</span>
                <span className="admin-summary-card__label">{def.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Registration progress by office */}
      <section className="workspace-card" aria-labelledby="admin-progress-h">
        <h2 id="admin-progress-h" className="workspace-card__title">Registration Progress by Office</h2>
        {summaryLoading ? (
          <p className="app-detail__empty">Loading…</p>
        ) : summaryMissing ? (
          <MissingEndpointNotice endpoint="GET /admin/dashboard/summary" onRetry={loadSummary} />
        ) : summaryError ? (
          <p className="app-detail__empty">Could not load this section.</p>
        ) : !summary?.registration_progress_by_office?.length ? (
          <p className="app-detail__empty">No registration activity recorded yet.</p>
        ) : (
          <div className="admin-office-progress-list">
            {summary.registration_progress_by_office.map((row) => {
              const total = (row.ready || 0) + (row.pending || 0) + (row.completed || 0)
              const pct = total > 0 ? Math.round((row.completed / total) * 100) : 0
              return (
                <div key={row.role_key} className="admin-office-progress">
                  <div className="admin-office-progress__head">
                    <span>{row.role_name || officeLabel(row.role_key)}</span>
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
          {logsLoading ? (
            <p className="app-detail__empty">Loading activity…</p>
          ) : logsError ? (
            <div className="workspace-error" role="alert">
              <span className="workspace-error__icon" aria-hidden="true">!</span>
              <div className="workspace-error__body">
                <span className="workspace-error__title">Could not load recent activity</span>
                <p className="workspace-error__text">{logsError}</p>
                <div className="workspace-error__actions">
                  <button type="button" className="btn btn--outline" onClick={loadLogs}>Try again</button>
                </div>
              </div>
            </div>
          ) : recentActivity.length === 0 ? (
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
                          {log.success ? 'Succeeded' : 'Did not succeed'} · View student record
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
            Derived from the last 50 logged audit events where an office requested a correction or
            rejected a clearance. A dedicated endpoint would give a complete, paginated list instead
            of this recent-activity sample — see the implementation report.
          </p>
          {logsLoading ? (
            <p className="app-detail__empty">Loading…</p>
          ) : logsError ? (
            <p className="app-detail__empty">Could not load this section.</p>
          ) : attentionItems.length === 0 ? (
            <p className="app-detail__empty">Nothing flagged in recent activity.</p>
          ) : (
            <ul className="admin-activity-list">
              {attentionItems.map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    className="admin-activity-row admin-activity-row--link"
                    onClick={() => onNavigate(`/admin/records/${log.application_id}`)}
                  >
                    <span className="admin-activity-row__main">
                      <span className="admin-activity-row__action">{formatAction(log.action)}</span>
                      <span className="admin-activity-row__meta">View student record</span>
                    </span>
                    <span className="admin-activity-row__time">{formatDateTime(log.occurred_at)}</span>
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
