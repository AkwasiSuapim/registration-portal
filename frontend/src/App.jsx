import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import RegisterStudent from './pages/RegisterStudent'
import AdminDashboard from './pages/AdminDashboard'
import StudentPortal from './pages/StudentPortal'
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
  const [currentPage, setCurrentPage]       = useState('home')
  const [currentSession, setCurrentSession] = useState(null)

  // Restore session from localStorage when the app first loads.
  // This preserves login state across page refreshes.
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('portalUserSession') || 'null')
    if (saved) setCurrentSession(saved)
  }, [])

  const handleLogin = (session) => {
    setCurrentSession(session)
  }

  const handleLogout = () => {
    localStorage.removeItem('portalUserSession')
    setCurrentSession(null)
    setCurrentPage('home')
  }

  const renderPage = () => {
    switch (currentPage) {

      case 'login':
        return (
          <Login
            onNavigate={setCurrentPage}
            onLogin={handleLogin}
          />
        )

      case 'register':
        return <RegisterStudent onNavigate={setCurrentPage} />

      case 'admin':
        // This is frontend-only access control for the prototype.
        // Real authorization will be enforced by the backend later.
        if (!currentSession || currentSession.userType !== 'official') {
          return (
            <AccessRequired
              message="Please log in as an official or registrar staff member to access the Admin Dashboard."
              onNavigate={setCurrentPage}
            />
          )
        }
        return <AdminDashboard onNavigate={setCurrentPage} />

      // Student Portal manages its own session check and application filtering internally.
      case 'student-portal':
        return <StudentPortal onNavigate={setCurrentPage} />

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
