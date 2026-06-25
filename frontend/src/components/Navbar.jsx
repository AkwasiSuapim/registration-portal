const navItems = [
  { page: 'home',     label: 'Home'           },
  { page: 'register', label: 'Register'        },
  { page: 'admin',    label: 'Admin Dashboard' },
]

function GraduationCapIcon() {
  return (
    <svg className="brand-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className="user-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  )
}

function Navbar({ currentPage, onNavigate }) {
  return (
    <nav className="navbar">
      <div className="navbar__brand">
        <div className="navbar__brand-icon">
          <GraduationCapIcon />
        </div>
        <div className="navbar__brand-text">
          <span className="navbar__brand-name">Livingstone College</span>
          <span className="navbar__brand-subtitle">Student Registration Portal</span>
        </div>
      </div>

      <div className="navbar__links">
        {navItems.map(({ page, label }) => {
          const classes = [
            'navbar__button',
            page === 'register'    && 'navbar__button--register',
            currentPage === page   && 'navbar__button--active',
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

      <button
        type="button"
        className="navbar__portal-link"
        onClick={() => onNavigate('home')}
      >
        <UserIcon />
        <span>Student Portal</span>
      </button>
    </nav>
  )
}

export default Navbar
