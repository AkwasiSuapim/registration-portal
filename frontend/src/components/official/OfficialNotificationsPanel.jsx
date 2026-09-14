import { useEffect, useState, useCallback } from 'react'
import { getNotifications, markNotificationRead } from '../../services/api'
import { formatDateTime } from './officialStatus'

// The navbar's NotificationBell (unchanged, reused everywhere) already
// gives every signed-in user — officials included — a quick-glance
// popover backed by the same GET /notifications call this panel makes.
// This panel is the Official Dashboard's persistent, in-context version
// of the same real data, categorized for the workflow events this
// office actually receives:
//   clearance_unlocked_*  → a new application became ready for review
//   document_uploaded_*   → a student added/replaced a document
//     (the closest available signal to "resubmission" — see the note
//     below; there is no dedicated resubmission event)
// "Deadlines" and "reopened reviews" are requirements this task asked
// for, but the backend never creates notifications for either — no
// due-date concept and no admin-reopen action exist (see notification
// model / clearance_service.py) — so they are named as a gap here
// instead of being invented.
function categorize(eventType) {
  if (eventType?.startsWith('clearance_unlocked_')) return 'New application ready'
  if (eventType?.startsWith('document_uploaded_')) return 'Student document update'
  return 'Update'
}

function OfficialNotificationsPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState([])

  // Shared reload used by "Mark read" — not inside a useEffect body.
  const load = useCallback(() => {
    setLoading(true)
    setError('')
    getNotifications({ limit: 10 })
      .then((data) => setNotifications(data.notifications))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Inlined (rather than calling load above) so this effect's body
  // never calls setState directly.
  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const data = await getNotifications({ limit: 10 })
        if (!cancelled) setNotifications(data.notifications)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const handleMarkRead = (id) => {
    markNotificationRead(id).then(load).catch(() => {})
  }

  return (
    <section className="workspace-card" aria-labelledby="official-notifications-h">
      <div className="workspace-card__head">
        <h2 id="official-notifications-h" className="workspace-card__title">Notifications</h2>
      </div>

      {loading && <p className="portal-status-panel__loading">Loading notifications…</p>}
      {!loading && error && <p className="portal-status-panel__error">{error}</p>}

      {!loading && !error && notifications.length === 0 && (
        <p className="official-empty-inline">No notifications right now.</p>
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="official-notification-list">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`official-notification-list__item${n.is_read ? '' : ' official-notification-list__item--unread'}`}
            >
              <div className="official-notification-list__main">
                <span className="official-notification-list__category">{categorize(n.event_type)}</span>
                <span className="official-notification-list__title">{n.title}</span>
                <span className="official-notification-list__time">{formatDateTime(n.created_at)}</span>
              </div>
              {!n.is_read && (
                <button type="button" className="btn btn--outline btn--small" onClick={() => handleMarkRead(n.id)}>
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="official-notice">
        Deadline reminders and reopened-review alerts are not shown here — the backend does not
        yet emit those events.
      </p>
    </section>
  )
}

export default OfficialNotificationsPanel
