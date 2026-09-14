import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import StudentPortal from './pages/StudentPortal'
import { getToken, getCurrentUser, logout } from './services/api'
import { STUDENT_PORTAL_PATH, STUDENT_REGISTRATION_PATH } from './utils/routes'
import './App.css'
import './components/siteChrome.css'

/* -------------------------------------------------------
   AccessRequired — shown in place of a protected page when the
   visitor can't be there: either not signed in at all ("Login
   Required", the default), or signed in as the wrong account type
   ("Unauthorized", via the title/actionLabel/actionPath overrides).
   Kept as an inline message rather than a hard redirect so the visitor
   understands why, with one clear way forward.
------------------------------------------------------- */
function AccessRequired({
  message,
  onNavigate,
  title = 'Login Required',
  actionLabel = 'Go to Login',
  actionPath = '/login',
}) {
  return (
    <div className="access-required">
      <div className="access-required__card">
        <svg
          className="access-required__icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z" />
        </svg>
        <h2 className="access-required__title">{title}</h2>
        <p className="access-required__message">{message}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onNavigate(actionPath)}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   RequireStudentRegistration — the one guard the Registration route
   goes through, in this order:
     1. Session still loading            -> caller keeps this off the
        tree entirely (see renderRoutes) so nothing protected flashes.
     2. No session                       -> send to /login, remembering
        this page as `from` so login can return here afterwards.
     3. Session, but not a student       -> Unauthorized, with a way
        back to their own dashboard — never a peek at the student form.
     4. Student session                  -> render the real page.
------------------------------------------------------- */
function RequireStudentRegistration({ currentSession, onNavigate, children }) {
  if (!currentSession) {
    return <Navigate to="/login" replace state={{ from: STUDENT_REGISTRATION_PATH }} />
  }

  if (currentSession.account_type !== 'student') {
    return (
      <AccessRequired
        title="Unauthorized"
        message="Student Registration is only available to student accounts. Head to your own dashboard instead."
        actionLabel="Go to My Dashboard"
        actionPath="/admin"
        onNavigate={onNavigate}
      />
    )
  }

  return children
}

/* -------------------------------------------------------
   App — root component
------------------------------------------------------- */
function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentSession, setCurrentSession]     = useState(null)
  const [restoringSession, setRestoringSession] = useState(true)
  const [sessionExpired, setSessionExpired]     = useState(false)

  // onNavigate is handed down to every page/nav component as the one
  // way to move around — it's a thin wrapper over React Router's
  // useNavigate so a click on Sign In, the logo, etc. changes the real
  // URL (shareable, back/forward-button aware) instead of just
  // swapping in-memory state.
  const onNavigate = navigate
  const isHome = location.pathname === '/'

  // Restore session on load — if a token was saved from a previous
  // visit, ask the backend who it belongs to via GET /auth/me. If the
  // token is missing, expired, or invalid, this simply leaves the user
  // logged out (api.js already clears a bad token for us).
  useEffect(() => {
    if (!getToken()) {
      setRestoringSession(false)
      return
    }
    getCurrentUser()
      .then((user) => setCurrentSession(user))
      .catch(() => {})
      .finally(() => setRestoringSession(false))
  }, [])

  // Any API call that gets a 401 on an authenticated request dispatches
  // this event (see services/api.js) — drop back to a logged-out state.
  useEffect(() => {
    const handleSessionExpired = () => {
      setCurrentSession(null)
      setSessionExpired(true)
      navigate('/login')
    }
    window.addEventListener('auth:session-expired', handleSessionExpired)
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired)
  }, [navigate])

  const handleLogin = (user) => {
    setCurrentSession(user)
  }

  const handleLogout = () => {
    logout()
    setCurrentSession(null)
    navigate('/')
  }

  const renderRoutes = () => {
    if (restoringSession) {
      return (
        <div className="session-restoring">
          <p>Restoring your session…</p>
        </div>
      )
    }

    return (
      <Routes>
        <Route path="/" element={<Home onNavigate={onNavigate} />} />

        <Route
          path="/login"
          element={
            <Login
              onNavigate={onNavigate}
              onLogin={handleLogin}
              sessionExpired={sessionExpired}
              onDismissSessionExpired={() => setSessionExpired(false)}
            />
          }
        />

        <Route
          path="/admin/*"
          element={
            // Backend-authorized access control — account_type comes from
            // GET /auth/me / the login response, never from a frontend choice.
            // "/admin/*" (rather than just "/admin") so the Admin Workspace's
            // own nested routes (user management, add/edit forms, student
            // records, office assignments — see pages/AdminWorkspace.jsx)
            // are real, deep-linkable URLs while staying behind this same
            // guard; officials, who only ever link to "/admin" itself, are
            // unaffected. Signed-in students get a distinct Unauthorized
            // message with a way back to their own dashboard, rather than
            // the generic "please log in" copy meant for signed-out visitors.
            !currentSession ? (
              <AccessRequired
                message="Please log in as an official or registrar staff member to access the Admin Dashboard."
                onNavigate={onNavigate}
              />
            ) : currentSession.account_type === 'student' ? (
              <AccessRequired
                title="Unauthorized"
                message="The Admin Dashboard is only available to official and administrator accounts. Head to your own dashboard instead."
                actionLabel="Go to My Dashboard"
                actionPath={STUDENT_PORTAL_PATH}
                onNavigate={onNavigate}
              />
            ) : (
              <AdminDashboard onNavigate={onNavigate} currentSession={currentSession} />
            )
          }
        />

        <Route
          path="/student-portal"
          element={<StudentPortal onNavigate={onNavigate} currentSession={currentSession} />}
        />

        {/* The canonical Registration destination — every landing-page
            and header Registration/Start Registration button points
            here. Same StudentPortal shell as above (it opens straight
            to the Registration tab for this URL); the guard is what's
            new — it's the only route that enforces "student session or
            bounce", so this is the one link that always resolves
            correctly regardless of who clicks it or whether they're
            signed in yet. */}
        <Route
          path={STUDENT_REGISTRATION_PATH}
          element={
            <RequireStudentRegistration currentSession={currentSession} onNavigate={onNavigate}>
              <StudentPortal onNavigate={onNavigate} currentSession={currentSession} />
            </RequireStudentRegistration>
          }
        />

        {/* Anything else falls back to the landing page rather than a
            dead end. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <>
      <Navbar
        currentPage={isHome ? 'home' : 'other'}
        onNavigate={onNavigate}
        currentSession={currentSession}
        onLogout={handleLogout}
        sessionLoading={restoringSession}
      />
      <main className="main-content">
        {renderRoutes()}
      </main>
      {/* The landing page gets the full footer; every other page (login,
          register, and the signed-in workspaces) gets the same footer
          in its compact form so dashboards don't grow unnecessarily long. */}
      <Footer
        variant={isHome ? 'full' : 'compact'}
        onNavigate={onNavigate}
        isAuthenticated={Boolean(currentSession)}
      />
    </>
  )
}

export default App
