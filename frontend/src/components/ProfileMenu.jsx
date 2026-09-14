import { useEffect, useRef, useState } from 'react'
import { initialFromName } from './navbarHelpers'

/* -------------------------------------------------------
   ProfileMenu — the header's profile control for any signed-in
   account (student, official, or admin). Shows a picture when one is
   available, otherwise the initials fallback — there is no photo field
   on the Student or Official models today, so every account currently
   uses the fallback (see navbarHelpers.js).

   Displays the account's name and role label side by side (e.g.
   "Avery" / "Student", "J. Ade" / "Financial Aid") — never the
   "Logged in as X" phrasing the previous navbar used. Logout lives
   inside this control's dropdown instead of a separate button, mirroring
   the click-outside/Escape pattern NotificationBell already uses.
------------------------------------------------------- */
function ProfileMenu({ name, roleLabel, avatarUrl, onLogout }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        type="button"
        className="profile-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}, ${roleLabel}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="profile-menu__avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : initialFromName(name)}
        </span>
        <span className="profile-menu__text">
          <span className="profile-menu__name">{name}</span>
          <span className="profile-menu__role">{roleLabel}</span>
        </span>
        <svg className="profile-menu__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="profile-menu__panel" role="menu" aria-label="Account">
          <div className="profile-menu__panel-header">
            <span className="profile-menu__panel-name">{name}</span>
            <span className="profile-menu__panel-role">{roleLabel}</span>
          </div>
          <button type="button" role="menuitem" className="profile-menu__logout" onClick={onLogout}>
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
