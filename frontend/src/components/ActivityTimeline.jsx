import { formatAction } from '../utils/backendLabels'

function formatTimestamp(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isPlainPrimitive(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

// `details` is whatever safe metadata the backend attached to the event
// (course counts, document type, or — for clearance actions — a
// before/after snapshot of the clearance's status). It never contains
// file paths, tokens, or password hashes. Only plain primitive values
// (or a before/after pair of them) are rendered — anything unexpected
// is skipped rather than dumped to the screen.
function ActivityDetails({ details }) {
  if (!details || typeof details !== 'object') return null

  const { before, after, ...rest } = details
  const flatEntries = Object.entries(rest).filter(([, value]) => isPlainPrimitive(value))

  const changeKeys = (before && after && typeof before === 'object' && typeof after === 'object')
    ? Object.keys({ ...before, ...after }).filter(
        (key) => isPlainPrimitive(before[key]) && isPlainPrimitive(after[key]) && before[key] !== after[key]
      )
    : []

  if (flatEntries.length === 0 && changeKeys.length === 0) return null

  return (
    <dl className="activity-entry__details">
      {changeKeys.map((key) => (
        <div key={`change-${key}`} className="activity-entry__detail-row">
          <dt>{formatAction(key)}</dt>
          <dd>{before[key] ?? '—'} → {after[key] ?? '—'}</dd>
        </div>
      ))}
      {flatEntries.map(([key, value]) => (
        <div key={key} className="activity-entry__detail-row">
          <dt>{formatAction(key)}</dt>
          <dd>{value === null ? '—' : String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function ActivityTimeline({ activity }) {
  if (!activity || activity.length === 0) {
    return <p className="activity-timeline__empty">No activity recorded yet.</p>
  }

  return (
    <ul className="activity-timeline">
      {activity.map((entry) => (
        <li key={entry.id} className="activity-entry">
          <div className="activity-entry__top">
            <span className="activity-entry__action">{formatAction(entry.action)}</span>
            <span className="activity-entry__time">{formatTimestamp(entry.occurred_at)}</span>
          </div>
          {!entry.success && (
            <span className="activity-entry__failed">Action did not succeed</span>
          )}
          <ActivityDetails details={entry.details} />
        </li>
      ))}
    </ul>
  )
}

export default ActivityTimeline
