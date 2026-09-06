import NotificationBell from './NotificationBell'
import lcLogo from '../assets/landing/lc-logo.png'

// Nav items that always appear in the centre of the navbar.
// The Register item gets a blue pill style via navbar__button--register.
const navItems = [
  { page: 'home',           label: 'Home'            },
  { page: 'register',       label: 'Register'        },
  { page: 'student-portal', label: 'Student Portal'  },
  { page: 'admin',          label: 'Admin Dashboard' },
]

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
          <img className="brand-icon" src={lcLogo} alt="Livingstone College logo" />
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
