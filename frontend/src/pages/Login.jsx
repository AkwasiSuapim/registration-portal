import { useEffect, useRef, useState } from 'react'
import {
  isValidStaffEmail,
  isEduStudentIdentifier,
} from '../utils/registrationWorkflow'
import { login } from '../services/api'
import campusPhoto from '../assets/login/campus.jpg'
import lcLogoWhite from '../assets/login/lc-logo-white.png'

// Login calls the real backend (POST /auth/login) with whatever
// identifier the visitor enters — a student ID, a student email, or a
// staff email. The backend response (account_type / role_key) is what
// actually decides who this account is and where it gets routed;
// this page never chooses that itself.

/* -------------------------------------------------------
   validateField — per-field validation, returning the inline
   hint text to show (or '' when the field is valid).
------------------------------------------------------- */
function identifierHint(identifier) {
  const trimmed = identifier.trim()
  if (!trimmed) return 'Enter your student ID or college email.'
  if (isEduStudentIdentifier(trimmed) || isValidStaffEmail(trimmed)) return ''
  if (trimmed.includes('@')) {
    return 'Use your @student.livingstone.edu or @livingstone.edu email.'
  }
  return 'Student ID must start with 100 and contain 9 digits total.'
}

function passwordHint(password) {
  return password ? '' : 'Enter your password.'
}

/* -------------------------------------------------------
   Login — main page component
------------------------------------------------------- */
function Login({ onNavigate, onLogin, sessionExpired, onDismissSessionExpired }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [reveal, setReveal]         = useState(false)
  const [remember, setRemember]     = useState(true)

  const [touched, setTouched]       = useState(false)
  const [loggingIn, setLoggingIn]   = useState(false)
  const [formError, setFormError]   = useState('')

  const identifierRef = useRef(null)

  // Autofocus the first field on arrival — a keyboard-first entry
  // point into the form.
  useEffect(() => {
    identifierRef.current?.focus()
  }, [])

  // The "session expired" banner belongs to the visit that triggered
  // it — once this page is left, clear it so a later, unrelated visit
  // to /login starts clean.
  useEffect(() => {
    return () => onDismissSessionExpired?.()
  }, [onDismissSessionExpired])

  const idHint = touched ? identifierHint(identifier) : ''
  const pwHint = touched ? passwordHint(password) : ''
  const idInvalid = Boolean(formError) || Boolean(idHint)
  const pwInvalid = Boolean(formError) || Boolean(pwHint)

  const canSubmit = !identifierHint(identifier) && !passwordHint(password) && !loggingIn

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (identifierHint(identifier) || passwordHint(password)) {
      setTouched(true)
      return
    }

    setTouched(false)
    setFormError('')
    setLoggingIn(true)

    try {
      const user = await login(identifier.trim(), password)
      onLogin(user)
      onNavigate(user.account_type === 'student' ? 'student-portal' : 'admin')
    } catch (err) {
      setFormError(err.message || 'The ID/email or password you entered is incorrect. Please try again.')
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <div className="login-page">
      <img className="login-page__bg" src={campusPhoto} alt="" aria-hidden="true" />
      <div className="login-page__scrim" aria-hidden="true"></div>

      <main className="login-page__main">
        <div className="login-page__frame">

          <div className="login-card">

            <div className="login-card__brand">
              <img className="login-card__logo" src={lcLogoWhite} alt="Livingstone College" />
              <span className="login-card__brand-label">Student Registration &amp; Clearance Portal</span>
            </div>

            <div className="login-card__divider"></div>

            <div className="login-card__heading">
              <h1 className="login-card__title">Welcome back</h1>
              <p className="login-card__subtitle">Sign in to continue your registration.</p>
            </div>

            {sessionExpired && (
              <div className="login-banner" role="alert">
                <span className="login-banner__dot" aria-hidden="true"></span>
                <div>
                  <span className="login-banner__title">Session expired</span>
                  <span className="login-banner__text">You were signed out after a period of inactivity. Sign in again to continue.</span>
                </div>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit} noValidate>

              <div className="login-field">
                <label className="login-field__label" htmlFor="login-identifier">
                  Student ID or college email
                </label>
                <input
                  id="login-identifier"
                  ref={identifierRef}
                  className="login-field__control"
                  type="text"
                  name="identifier"
                  autoComplete="username"
                  placeholder="Enter your student ID or college email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loggingIn}
                  aria-invalid={idInvalid}
                  aria-describedby={formError ? 'login-form-error' : undefined}
                  data-invalid={idInvalid || undefined}
                />
                {idHint && !formError && (
                  <span className="login-field__hint">{idHint}</span>
                )}
              </div>

              <div className="login-field">
                <label className="login-field__label" htmlFor="login-password">
                  Password
                </label>
                <div className="login-password">
                  <input
                    id="login-password"
                    className="login-field__control login-password__control"
                    type={reveal ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loggingIn}
                    aria-invalid={pwInvalid}
                    aria-describedby={formError ? 'login-form-error' : undefined}
                    data-invalid={pwInvalid || undefined}
                  />
                  <button
                    type="button"
                    className="login-password__toggle"
                    onClick={() => setReveal((r) => !r)}
                    disabled={loggingIn}
                    aria-pressed={reveal}
                    aria-controls="login-password"
                  >
                    {reveal ? 'Hide' : 'Show'}
                  </button>
                </div>
                {pwHint && !formError && (
                  <span className="login-field__hint">{pwHint}</span>
                )}
              </div>

              {formError && (
                <div id="login-form-error" className="login-error" role="alert">
                  <span className="login-error__icon" aria-hidden="true">!</span>
                  <span className="login-error__text">{formError}</span>
                </div>
              )}

              <div className="login-options">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={loggingIn}
                  />
                  Remember me
                </label>
                <a className="login-forgot" href="mailto:info@livingstone.edu">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className={`login-submit${loggingIn ? ' login-submit--loading' : !canSubmit ? ' login-submit--blocked' : ''}`}
                disabled={!canSubmit}
                aria-busy={loggingIn}
              >
                {loggingIn && <span className="login-submit__spinner" aria-hidden="true"></span>}
                {loggingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="login-card__divider login-card__divider--tight"></div>

            <p className="login-support">
              Need help accessing your account?{' '}
              <a href="mailto:info@livingstone.edu">Contact Registration Support.</a>
            </p>
          </div>

          <div className="login-back-wrap">
            <button type="button" className="login-back" onClick={() => onNavigate('home')}>
              <span aria-hidden="true">&#8592;</span> Back to portal home
            </button>
          </div>
        </div>
      </main>

      <footer className="login-footer">
        <div className="login-footer__links">
          <a href="#top">Privacy</a>
          <a href="#top">Accessibility</a>
          <a href="mailto:info@livingstone.edu">Support</a>
        </div>
        <p className="login-footer__copy">Livingstone College &middot; Office of the Registrar &middot; Authorized use only</p>
      </footer>
    </div>
  )
}

export default Login
