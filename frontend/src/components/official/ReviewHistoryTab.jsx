import { useMemo, useState } from 'react'
import ApplicationCard from './ApplicationCard'
import { computeItemStatus, isQueueRelevant } from './officialStatus'

const HISTORY_STATUS_FILTERS = [
  { value: 'all',                 label: 'All' },
  { value: 'approved',            label: 'Approved' },
  { value: 'correction_required', label: 'Correction Requested' },
  { value: 'rejected',            label: 'Rejected' },
  { value: 'in_person_required',  label: 'In-Person Required' },
]

// Review History — applications this OFFICE has already acted on at
// least once (status !== 'pending'). The backend does not expose which
// individual official reviewed a clearance (ClearanceResponse has no
// reviewed_by field — see backend/app/schemas/clearance.py), so this is
// scoped to the office's shared history rather than "reviewed by me"
// specifically; that gap is called out in the feature's final summary.
//
// Every row here is read-only in the Review panel: nothing in the
// backend ever resets a finalized clearance's availability back to
// "ready" (there is no admin-reopen endpoint), so the same
// ClearanceActionBlock guard that hides action buttons once a decision
// is final applies automatically — no extra state is needed to enforce
// "read-only unless reopened."
function ReviewHistoryTab({ queue, queueLoading, queueError, onRetry, onOpenApplication }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [semesterFilter, setSemesterFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')

  const reviewed = useMemo(() => {
    return queue
      .filter(isQueueRelevant)
      .filter((item) => item.clearance_status !== 'pending')
      .map((item) => ({ item, status: computeItemStatus(item, false) }))
  }, [queue])

  const semesters = useMemo(() => {
    const set = new Set(reviewed.map((row) => row.item.term_code))
    return Array.from(set).sort()
  }, [reviewed])

  const filtered = useMemo(() => {
    let rows = reviewed
    if (statusFilter !== 'all') rows = rows.filter((row) => row.status === statusFilter)
    if (semesterFilter !== 'all') rows = rows.filter((row) => row.item.term_code === semesterFilter)
    rows = [...rows].sort((a, b) => {
      const aTime = a.item.submitted_at ? new Date(a.item.submitted_at).getTime() : 0
      const bTime = b.item.submitted_at ? new Date(b.item.submitted_at).getTime() : 0
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
    })
    return rows
  }, [reviewed, statusFilter, semesterFilter, sortOrder])

  if (queueLoading) {
    return <p className="portal-status-panel__loading">Loading review history…</p>
  }

  if (queueError) {
    return (
      <div className="workspace-error" role="alert">
        <span className="workspace-error__icon" aria-hidden="true">!</span>
        <div className="workspace-error__body">
          <span className="workspace-error__title">We could not load review history</span>
          <p className="workspace-error__text">{queueError}</p>
          <div className="workspace-error__actions">
            <button type="button" className="btn btn--outline" onClick={onRetry}>Try again</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="workspace-panel">
      <div>
        <h1 className="workspace-hero__title">Review History</h1>
        <p className="workspace-hero__subtitle">
          Applications this office has already reviewed. Completed reviews are read-only.
        </p>
      </div>

      <p className="official-notice">
        This list reflects your office's shared history, not only decisions you personally
        recorded — the API does not report which staff member reviewed a clearance.
      </p>

      <div className="official-history-filters">
        <div className="queue-filter-tabs" role="tablist" aria-label="Decision filter">
          {HISTORY_STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={statusFilter === option.value}
              className={`queue-filter-tab${statusFilter === option.value ? ' queue-filter-tab--active' : ''}`}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="official-history-filters__field">
          <span>Semester</span>
          <select value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}>
            <option value="all">All semesters</option>
            {semesters.map((term) => <option key={term} value={term}>{term}</option>)}
          </select>
        </label>

        <label className="official-history-filters__field">
          <span>Sort by submission date</span>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <p className="official-notice">
        Sorted by submission date — the API does not return when this office recorded its
        decision, so a true "review date" filter is not available yet.
      </p>

      {filtered.length === 0 ? (
        <div className="workspace-empty">
          <h3 className="workspace-empty__title">No reviewed applications yet</h3>
          <p className="workspace-empty__text">
            Once your office records a decision, it will appear here.
          </p>
        </div>
      ) : (
        <div className="official-card-list">
          {filtered.map((row) => (
            <ApplicationCard
              key={row.item.clearance_id}
              item={row.item}
              status={row.status}
              claimed={false}
              hasDraft={false}
              onReview={() => onOpenApplication(row.item.application_id, row.item.clearance_id)}
              onAssignToMe={null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ReviewHistoryTab
