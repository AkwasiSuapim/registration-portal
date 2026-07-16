import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/api'

function formatTimestamp(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Bell icon in the navbar — shown for any logged-in user. The backend
// already scopes visibility (students see their own; officials see
// direct + office-role notifications), so this component just displays
// whatever GET /notifications returns.
function NotificationBell() {
  const [open, setOpen]                 = useState(false)
  const [unreadCount, setUnreadCount]   = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    getUnreadNotificationCount()
      .then((data) => setUnreadCount(data.unread_count))
      .catch(() => {})
  }, [])

  const loadNotifications = useCallback(() => {
    setLoading(true)
    setError('')
    getNotifications({ limit: 20 })
      .then((data) => {
        setNotifications(data.notifications)
        setUnreadCount(data.unread_count)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next) loadNotifications()
  }

  const handleMarkRead = (notificationId) => {
    markNotificationRead(notificationId)
      .then(loadNotifications)
      .catch(() => {})
  }

  const handleMarkAllRead = () => {
    markAllNotificationsRead()
      .then(loadNotifications)
      .catch(() => {})
  }

  // Close the panel when clicking anywhere outside it
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell__button"
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <svg className="notification-bell__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel__header">
            <span className="notification-panel__title">Notifications</span>
            <button type="button" className="notification-panel__mark-all" onClick={handleMarkAllRead}>
              Mark all read
            </button>
          </div>

          {loading && <p className="notification-panel__status">Loading…</p>}
          {error && <p className="notification-panel__status notification-panel__status--error">{error}</p>}

          {!loading && !error && notifications.length === 0 && (
            <p className="notification-panel__status">You're all caught up.</p>
          )}

          {!loading && !error && notifications.length > 0 && (
            <ul className="notification-panel__list">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`notification-panel__item${notification.is_read ? '' : ' notification-panel__item--unread'}`}
                  onClick={() => !notification.is_read && handleMarkRead(notification.id)}
                >
                  <span className="notification-panel__item-title">{notification.title}</span>
                  <p className="notification-panel__item-body">{notification.body}</p>
                  <span className="notification-panel__item-time">{formatTimestamp(notification.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
