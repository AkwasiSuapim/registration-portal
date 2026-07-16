import { statusSlug } from '../utils/backendLabels'

function StatusBadge({ status }) {
  const display = status || 'Pending'
  return (
    <span className={`status-badge status-badge--${statusSlug(display)}`}>
      {display}
    </span>
  )
}

export default StatusBadge
