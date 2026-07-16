import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import RegisterStudent from './pages/RegisterStudent'
import AdminDashboard from './pages/AdminDashboard'
import StudentPortal from './pages/StudentPortal'
import { getToken, getCurrentUser, logout } from './services/api'
import './App.css'

/* -------------------------------------------------------
   AccessRequired — shown when a user tries to open a
   protected page without the correct session type.
   Keeps the guard logic simple — just a friendly redirect.
------------------------------------------------------- */
function AccessRequired({ message, onNavigate }) {
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
        <h2 className="access-required__title">Login Required</h2>
        <p className="access-required__message">{message}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onNavigate('login')}
        >
          Go to Login
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   App — root component
------------------------------------------------------- */
function App() {
  const [currentPage, setCurrentPage]           = useState('home')
  const [currentSession, setCurrentSession]     = useState(null)
  const [restoringSession, setRestoringSession] = useState(true)

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
      setCurrentPage('login')
    }
    window.addEventListener('auth:session-expired', handleSessionExpired)
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired)
  }, [])

  const handleLogin = (user) => {
    setCurrentSession(user)
  }

  const handleLogout = () => {
    logout()
    setCurrentSession(null)
    setCurrentPage('home')
  }

  const renderPage = () => {
    if (restoringSession) {
      return (
        <div className="session-restoring">
          <p>Restoring your session…</p>
        </div>
      )
    }

    switch (currentPage) {

      case 'login':
        return (
          <Login
            onNavigate={setCurrentPage}
            onLogin={handleLogin}
          />
        )

      case 'register':
        // The backend is the source of truth here too — only an
        // authenticated student account may submit an application.
        if (!currentSession || currentSession.account_type !== 'student') {
          return (
            <AccessRequired
              message="Please log in as a student to start a registration application."
              onNavigate={setCurrentPage}
            />
          )
        }
        return <RegisterStudent onNavigate={setCurrentPage} />

      case 'admin':
        // Backend-authorized access control — account_type comes from
        // GET /auth/me / the login response, never from a frontend choice.
        if (!currentSession || !['official', 'admin'].includes(currentSession.account_type)) {
          return (
            <AccessRequired
              message="Please log in as an official or registrar staff member to access the Admin Dashboard."
              onNavigate={setCurrentPage}
            />
          )
        }
        return <AdminDashboard onNavigate={setCurrentPage} currentSession={currentSession} />

      case 'student-portal':
        return <StudentPortal onNavigate={setCurrentPage} currentSession={currentSession} />

      default:
        return <Home onNavigate={setCurrentPage} />
    }
  }

  return (
    <>
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentSession={currentSession}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {renderPage()}
      </main>
    </>
  )
}

export default App
