import { useEffect, useState } from 'react'
import NotificationBell from './NotificationBell'
import ProfileMenu from './ProfileMenu'
import { deriveNavRole, deriveOfficeLabel, deriveDisplayName } from './navbarHelpers'
import { STUDENT_REGISTRATION_PATH } from '../utils/routes'
import lcLogo from '../assets/landing/lc-logo.png'

// Public landing-page sections a visitor can jump to from the header.
// Each id already exists on Home.jsx (id="top" doubles as the page's
// introductory/"about" section) — no page content changes for this.
const SECTION_LINKS = [
  { id: 'top',           label: 'About'         },
  { id: 'how-it-works',  label: 'How It Works'  },
  { id: 'benefits',      label: 'Benefits'      },
  { id: 'offices',       label: 'Offices'       },
  { id: 'faqs',          label: 'FAQs'          },
]

function Navbar({ currentPage, onNavigate, currentSession, onLogout, sessionLoading }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // While the app is still asking the backend who this token belongs
  // to (GET /auth/me), the role is unknown — showing the public nav
  // here would flash "Sign In" / "Start Registration" at an already
  // signed-in student for a moment, and showing any role's nav based
  // on a guess would be worse. Only the logo renders until it resolves.
  const role = sessionLoading ? 'loading' : deriveNavRole(currentSession)

  // Body scroll lock while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [mobileOpen])

  const goHome = () => { setMobileOpen(false); onNavigate('/') }

  // Jumps to a landing-page section, navigating home first if needed.
  // The double requestAnimationFrame gives Home a chance to mount
  // before its section elements are queried.
  const goToSection = (sectionId) => {
    setMobileOpen(false)
    const scroll = () => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
    if (currentPage !== 'home') {
      onNavigate('/')
      requestAnimationFrame(() => requestAnimationFrame(scroll))
    } else {
      scroll()
    }
  }

  const go = (path) => {
    setMobileOpen(false)
    onNavigate(path)
  }

  const handleLogout = () => {
    setMobileOpen(false)
    onLogout()
  }

  /* -------------------------------------------------------
     Role-derived nav content. Every branch below only reads
     currentSession (real backend data) — nothing here is hardcoded to
     a specific person, and switching roles is never possible from the
     UI; it only ever reflects what the backend session says right now.
  ------------------------------------------------------- */
  const isPublic = role === 'public'
  const isLoading = role === 'loading'
  const officeLabel = role === 'official' ? deriveOfficeLabel(currentSession) : null
  const displayName = currentSession ? deriveDisplayName(currentSession.email) : null

  let roleLabel = null
  let roleLinkLabel = null
  let roleLinkPage = null
  if (role === 'student') {
    roleLabel = 'Student'
  } else if (role === 'official') {
    roleLabel = officeLabel
    roleLinkLabel = officeLabel
    roleLinkPage = '/admin'
  } else if (role === 'admin') {
    roleLabel = 'Administrator'
    roleLinkLabel = 'Admin Dashboard'
    roleLinkPage = '/admin'
  }

  const renderRoleLinks = (linkClassName) => (
    <>
      {role === 'student' && (
        <>
          <button type="button" className={linkClassName} onClick={() => go('/student-portal')}>Student Portal</button>
          <button type="button" className={linkClassName} onClick={() => go(STUDENT_REGISTRATION_PATH)}>Registration</button>
        </>
      )}
      {roleLinkPage && (
        <button type="button" className={linkClassName} onClick={() => go(roleLinkPage)}>{roleLinkLabel}</button>
      )}
    </>
  )

  const profileControl = currentSession && (
    <ProfileMenu name={displayName} roleLabel={roleLabel} onLogout={handleLogout} />
  )

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__bar">

        <button type="button" className="nav__brand" onClick={goHome} aria-label="Livingstone College — go to homepage">
          <img className="nav__brand-mark" src={lcLogo} alt="" />
          <span className="nav__brand-text">
            <span className="nav__brand-name">Livingstone College</span>
            <span className="nav__brand-subtitle">Registration Portal</span>
          </span>
        </button>

        {!isLoading && (
          <>
            {/* Desktop navigation */}
            <div className="nav__links">
              {(isPublic ? SECTION_LINKS : SECTION_LINKS.slice(0, 1)).map(({ id, label }) => (
                <button key={id} type="button" className="nav-link" onClick={() => goToSection(id)}>{label}</button>
              ))}
              {renderRoleLinks('nav-link')}
            </div>

            <div className="nav__actions">
              {isPublic && (
                <>
                  <button type="button" className="nav-pill nav-pill--outline" onClick={() => go('/login')}>
                    Sign In
                  </button>
                  <button type="button" className="nav-pill nav-pill--primary" onClick={() => go(STUDENT_REGISTRATION_PATH)}>
                    Start Registration
                  </button>
                </>
              )}
              {!isPublic && <NotificationBell />}
              {profileControl}

              <button
                type="button"
                className="nav__menu-btn"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="nav-drawer"
                onClick={() => setMobileOpen((v) => !v)}
              >
                <span className={`nav__menu-icon${mobileOpen ? ' nav__menu-icon--open' : ''}`} aria-hidden="true">
                  <span /><span /><span />
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="nav-drawer-overlay" onClick={() => setMobileOpen(false)}>
          <div
            id="nav-drawer"
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(event) => event.stopPropagation()}
          >
            {(isPublic ? SECTION_LINKS : SECTION_LINKS.slice(0, 1)).map(({ id, label }) => (
              <button key={id} type="button" className="nav-link nav-drawer__link" onClick={() => goToSection(id)}>{label}</button>
            ))}
            {renderRoleLinks('nav-link nav-drawer__link')}

            <div className="nav-drawer__footer">
              {isPublic && (
                <>
                  <button type="button" className="nav-pill nav-pill--outline" onClick={() => go('/login')}>Sign In</button>
                  <button type="button" className="nav-pill nav-pill--primary" onClick={() => go(STUDENT_REGISTRATION_PATH)}>Start Registration</button>
                </>
              )}
              {!isPublic && !isLoading && (
                <button type="button" className="nav-pill nav-pill--outline" onClick={handleLogout}>Log Out</button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
