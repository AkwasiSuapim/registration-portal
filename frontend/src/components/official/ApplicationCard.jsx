import StatusBadge from '../StatusBadge'
import { STATUS_LABELS, studentInitials, formatDate } from './officialStatus'

// Horizontal application card used across every queue section of the
// Official Dashboard. The backend Student model has no photo field
// (see officialStatus.js), so every card shows the initials fallback —
// there is no code path that silently fails to load a real photo.
function ApplicationCard({ item, status, claimed, hasDraft, onReview, onAssignToMe }) {
  return (
    <div className="official-card">
      <div className="official-card__avatar" aria-hidden="true">
        {studentInitials(item.student_name)}
      </div>

      <div className="official-card__body">
        <div className="official-card__top">
          <span className="official-card__name">{item.student_name}</span>
          <StatusBadge status={STATUS_LABELS[status] || status} />
        </div>
        <dl className="official-card__meta">
          <div><dt>Student ID</dt><dd>{item.student_no}</dd></div>
          <div><dt>Classification</dt><dd>{item.classification || '—'}</dd></div>
          <div><dt>Semester</dt><dd>{item.term_code}</dd></div>
          <div><dt>Submitted</dt><dd>{formatDate(item.submitted_at)}</dd></div>
        </dl>
        {item.blocked_reason && (
          <p className="official-card__note">{item.blocked_reason}</p>
        )}
      </div>

      <div className="official-card__actions">
        {!claimed && onAssignToMe && (
          <button type="button" className="btn btn--outline btn--small" onClick={() => onAssignToMe(item)}>
            Assign to Me
          </button>
        )}
        <button type="button" className="btn btn--primary btn--small" onClick={() => onReview(item)}>
          {hasDraft ? 'Continue Review' : 'Review'}
        </button>
      </div>
    </div>
  )
}

export default ApplicationCard
