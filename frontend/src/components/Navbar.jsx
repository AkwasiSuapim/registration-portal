import NotificationBell from './NotificationBell'

// Nav items that always appear in the centre of the navbar.
// The Register item gets a blue pill style via navbar__button--register.
const navItems = [
  { page: 'home',           label: 'Home'            },
  { page: 'register',       label: 'Register'        },
  { page: 'student-portal', label: 'Student Portal'  },
  { page: 'admin',          label: 'Admin Dashboard' },
]

function GraduationCapIcon() {
  return (
    <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
    </svg>
  )
}

function Navbar({ currentPage, onNavigate, currentSession, onLogout }) {
  // role_name comes straight from the backend (GET /auth/me / login
  // response) — "Student" for students, the office name for officials,
  // "System Admin" for admins. No frontend guessing involved.
  const sessionLabel = currentSession?.role_name || null

  return (
    <nav className="navbar">

      {/* Brand */}
      <div className="navbar__brand">
        <div className="navbar__brand-icon">
          <GraduationCapIcon />
        </div>
        <div className="navbar__brand-text">
          <span className="navbar__brand-name">Livingstone College</span>
          <span className="navbar__brand-subtitle">Student Registration Portal</span>
        </div>
      </div>

      {/* Centre navigation links */}
      <div className="navbar__links">
        {navItems.map(({ page, label }) => {
          const classes = [
            'navbar__button',
            page === 'register' && 'navbar__button--register',
            currentPage === page && 'navbar__button--active',
          ].filter(Boolean).join(' ')

          return (
            <button
              key={page}
              type="button"
              className={classes}
              onClick={() => onNavigate(page)}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Right side — shows Login when no session, or session info + Logout */}
      <div className="navbar__session-area">
        {currentSession ? (
          <>
            <NotificationBell />
            <span className="navbar__session-label">
              Logged in as: <strong>{sessionLabel}</strong>
            </span>
            <button
              type="button"
              className="navbar__logout-btn"
              onClick={onLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`navbar__login-btn${currentPage === 'login' ? ' navbar__login-btn--active' : ''}`}
            onClick={() => onNavigate('login')}
          >
            Login
          </button>
        )}
      </div>

    </nav>
  )
}

export default Navbar
