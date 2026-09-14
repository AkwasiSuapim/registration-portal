import { useState } from 'react'
import ApplicationCard from './ApplicationCard'
import OfficialNotificationsPanel from './OfficialNotificationsPanel'
import {
  DASHBOARD_FILTERS, OPEN_STATUSES,
  computeItemStatus, isQueueRelevant, matchesFilter, matchesSearch,
} from './officialStatus'
import { getClaimedClearanceIds, getDraft, claim } from '../../services/officialLocalState'

const SUMMARY_DEFS = [
  { key: 'new',                 label: 'New' },
  { key: 'in_review',           label: 'In Review' },
  { key: 'correction_required', label: 'Correction Requested' },
  { key: 'completed',           label: 'Completed' },
]

function QueueSection({ title, subtitle, items, claimedIds, drafts, onReview, onAssignToMe }) {
  if (items.length === 0) return null
  return (
    <section className="official-section">
      <div className="official-section__head">
        <h3 className="official-section__title">{title}</h3>
        {subtitle && <p className="official-section__subtitle">{subtitle}</p>}
      </div>
      <div className="official-card-list">
        {items.map((row) => (
          <ApplicationCard
            key={row.item.clearance_id}
            item={row.item}
            status={row.status}
            claimed={claimedIds.has(row.item.clearance_id)}
            hasDraft={Boolean(drafts[row.item.clearance_id])}
            onReview={() => onReview(row.item)}
            onAssignToMe={row.status !== 'approved' && row.status !== 'rejected' && row.status !== 'in_person_required' ? onAssignToMe : null}
          />
        ))}
      </div>
    </section>
  )
}

// Official Dashboard — loads the signed-in official's office queue
// (GET /officials/me/queue, unfiltered so New/In Review/Correction/
// Completed can all be counted client-side), then layers search,
// filters, and the three requested groupings on top of one in-memory
// list. See officialStatus.js for exactly how each status/filter maps
// onto the backend's real clearance_status/availability fields.
function OfficialDashboardTab({
  currentSession, queue, queueLoading, queueError, onRetry, onOpenApplication,
}) {
  const officialUserId = currentSession?.id
  const [filter, setFilter] = useState('assigned_to_me')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  // Bumped after every local claim to trigger a re-render — claims live
  // outside React state entirely (see officialLocalState.js), so
  // nothing else would tell React that localStorage changed.
  // eslint-disable-next-line no-unused-vars
  const [claimVersion, setClaimVersion] = useState(0)

  // Recomputed on every render (not memoized) — this queue is small,
  // and both reads go straight to localStorage rather than React state.
  const claimedIds = new Set(getClaimedClearanceIds(officialUserId))
  const drafts = {}
  for (const item of queue) {
    const draft = getDraft(officialUserId, item.clearance_id)
    if (draft) drafts[item.clearance_id] = draft
  }

  // None of these are wrapped in useMemo: claimedIds is a fresh Set
  // every render (it's read straight from localStorage, not React
  // state), so memoizing anything derived from it would just recompute
  // every render anyway. The queue is small, so this is cheap either way.
  const classified = queue
    .filter(isQueueRelevant)
    .map((item) => ({
      item,
      status: computeItemStatus(item, claimedIds.has(item.clearance_id)),
    }))

  const summaryCounts = { new: 0, in_review: 0, correction_required: 0, completed: 0 }
  for (const row of classified) {
    if (row.status === 'approved' || row.status === 'rejected' || row.status === 'in_person_required') {
      summaryCounts.completed += 1
    } else if (summaryCounts[row.status] !== undefined) {
      summaryCounts[row.status] += 1
    }
  }

  const visible = classified.filter((row) =>
    matchesFilter(filter, row.status, claimedIds.has(row.item.clearance_id)) &&
    matchesSearch(row.item, appliedSearch)
  )

  const newItems = visible.filter((row) => row.status === 'new')
  const inProgressItems = visible.filter((row) => row.status === 'in_review' || row.status === 'correction_required')
  const reviewedItems = visible.filter((row) => !OPEN_STATUSES.includes(row.status))

  const handleAssignToMe = (item) => {
    claim(officialUserId, item.clearance_id)
    setClaimVersion((v) => v + 1)
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setAppliedSearch(searchInput)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setAppliedSearch('')
  }

  if (queueLoading) {
    return (
      <div className="workspace-skeleton" aria-busy="true" aria-live="polite">
        <p className="workspace-skeleton__label">
          <span className="workspace-spinner" aria-hidden="true"></span>
          Loading your queue…
        </p>
        <div className="workspace-skeleton__row">
          <div className="workspace-skeleton__block"></div>
          <div className="workspace-skeleton__block"></div>
          <div className="workspace-skeleton__block"></div>
        </div>
        <div className="workspace-skeleton__block workspace-skeleton__block--tall"></div>
      </div>
    )
  }

  if (queueError) {
    return (
      <div className="workspace-error" role="alert">
        <span className="workspace-error__icon" aria-hidden="true">!</span>
        <div className="workspace-error__body">
          <span className="workspace-error__title">We could not load your queue</span>
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

      {/* Summary cards */}
      <div className="official-summary-grid">
        {SUMMARY_DEFS.map((def) => (
          <button
            key={def.key}
            type="button"
            className={`official-summary-card${filter === def.key ? ' official-summary-card--active' : ''}`}
            onClick={() => setFilter(def.key)}
          >
            <span className="official-summary-card__value">{summaryCounts[def.key]}</span>
            <span className="official-summary-card__label">{def.label}</span>
          </button>
        ))}
      </div>

      <OfficialNotificationsPanel />

      {/* Search */}
      <form className="official-search" onSubmit={handleSearchSubmit} role="search" aria-label="Search applications">
        <input
          type="search"
          className="official-search__input"
          placeholder="Search by student name, student ID, or application ID…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search by student name, student ID, or application ID"
        />
        <button type="submit" className="btn btn--primary">Search</button>
        {appliedSearch && (
          <button type="button" className="btn btn--outline" onClick={handleClearSearch}>Clear Search</button>
        )}
      </form>
      {appliedSearch && (
        <p className="official-search__result-count" aria-live="polite">
          {visible.length} result{visible.length === 1 ? '' : 's'} for “{appliedSearch}”
        </p>
      )}
      <p className="official-notice">
        Search matches student name, student ID, and application number. The queue endpoint does
        not return a student's email address, so email search is not available.
      </p>

      {/* Filters */}
      <div className="queue-filter-tabs" role="tablist" aria-label="Queue filters">
        {DASHBOARD_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            className={`queue-filter-tab${filter === option.value ? ' queue-filter-tab--active' : ''}`}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {filter === 'resubmitted' && (
        <p className="official-notice">
          The backend does not record when a student resubmits after a correction request, so this
          filter cannot show results yet — see the missing API support note for this feature.
        </p>
      )}
      {(filter === 'assigned_to_me' || filter === 'unassigned') && (
        <p className="official-notice">
          Assignment is tracked on this device only — it is not shared with other staff signed in
          to the same office elsewhere (no backend field records who picked up an item).
        </p>
      )}

      {/* Empty / no-results states */}
      {visible.length === 0 && (
        <div className="workspace-empty">
          <h3 className="workspace-empty__title">
            {appliedSearch ? 'No matching applications' : 'Nothing here right now'}
          </h3>
          <p className="workspace-empty__text">
            {appliedSearch
              ? 'Try a different name, student ID, or application number.'
              : filter === 'assigned_to_me'
                ? 'You have not claimed anything yet. Switch to Unassigned to find applications to pick up.'
                : 'No applications match this filter right now.'}
          </p>
          {filter === 'assigned_to_me' && !appliedSearch && (
            <button type="button" className="btn btn--primary" onClick={() => setFilter('unassigned')}>
              View Unassigned
            </button>
          )}
        </div>
      )}

      <QueueSection
        title="New Applications"
        items={newItems}
        claimedIds={claimedIds}
        drafts={drafts}
        onReview={(item) => onOpenApplication(item.application_id, item.clearance_id)}
        onAssignToMe={handleAssignToMe}
      />
      <QueueSection
        title="In Progress"
        items={inProgressItems}
        claimedIds={claimedIds}
        drafts={drafts}
        onReview={(item) => onOpenApplication(item.application_id, item.clearance_id)}
        onAssignToMe={handleAssignToMe}
      />
      <QueueSection
        title="Recently Reviewed"
        subtitle="Ordered by submission date — the API does not return when this office recorded its decision."
        items={reviewedItems}
        claimedIds={claimedIds}
        drafts={drafts}
        onReview={(item) => onOpenApplication(item.application_id, item.clearance_id)}
        onAssignToMe={null}
      />
    </div>
  )
}

export default OfficialDashboardTab
