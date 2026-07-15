import { useState } from 'react'
import {
  OFFICE_ROLES,
  isValidStudentEmail,
  isValidStaffEmail,
  isEduStudentIdentifier,
} from '../utils/registrationWorkflow'

// This is frontend-only login simulation for the prototype.
// Real authentication will be handled by the backend later.

/* -------------------------------------------------------
   Reusable form field — reuses existing .form-field styles
------------------------------------------------------- */
function LoginField({ label, type, name, value, placeholder, onChange }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <input
        className="form-field__control"
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        autoComplete="off"
      />
    </label>
  )
}

/* -------------------------------------------------------
   validateStudentForm — returns an array of error strings.
   Students log in with either a student ID or student email,
   plus a password (not verified yet — backend will handle that).
------------------------------------------------------- */
function validateStudentForm(identifier, password) {
  const errs = []

  if (!identifier.trim()) {
    errs.push('Student ID or Email is required.')
  } else if (!isEduStudentIdentifier(identifier)) {
    // Give a specific message based on what the user appeared to enter
    if (identifier.includes('@')) {
      errs.push('Please use your Livingstone student email ending in @student.livingstone.edu.')
    } else {
      errs.push('Student ID must start with 100 and contain 9 digits total.')
    }
  }

  if (!password.trim()) {
    errs.push('Password is required.')
  }

  return errs
}

/* -------------------------------------------------------
   validateOfficialForm — returns an array of error strings.
   Officials log in with their staff email, password, and office role.
------------------------------------------------------- */
function validateOfficialForm(staffEmail, password, officeRole) {
  const errs = []

  if (!staffEmail.trim()) {
    errs.push('Staff Email is required.')
  } else if (!isValidStaffEmail(staffEmail)) {
    errs.push('Please use your official Livingstone staff email ending in @livingstone.edu.')
  }

  if (!password.trim()) {
    errs.push('Password is required.')
  }

  if (!officeRole) {
    errs.push('Please select an Office Role.')
  }

  return errs
}

/* -------------------------------------------------------
   Login — main page component
------------------------------------------------------- */
function Login({ onNavigate, onLogin }) {
  // 'student' | 'official' | '' (nothing selected yet)
  const [accessType, setAccessType] = useState('')

  const [studentForm, setStudentForm]   = useState({ identifier: '', password: '' })
  const [officialForm, setOfficialForm] = useState({ staffEmail: '', password: '', officeRole: '' })

  const [errors, setErrors] = useState([])

  const handleAccessTypeChange = (type) => {
    setAccessType(type)
    setErrors([])
  }

  const handleStudentChange = (event) => {
    const { name, value } = event.target
    setStudentForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleOfficialChange = (event) => {
    const { name, value } = event.target
    setOfficialForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogin = () => {
    if (!accessType) {
      setErrors(['Please select an access type to continue.'])
      return
    }

    if (accessType === 'student') {
      const errs = validateStudentForm(studentForm.identifier, studentForm.password)
      if (errs.length > 0) { setErrors(errs); return }

      // Determine whether the student used an ID or email so the
      // Student Portal can match their application correctly
      const usedEmail = isValidStudentEmail(studentForm.identifier)
      const session = {
        userType:    'student',
        loginMethod: usedEmail ? 'email' : 'studentId',
        studentId:   usedEmail ? '' : studentForm.identifier.trim(),
        email:       usedEmail ? studentForm.identifier.trim() : '',
      }
      localStorage.setItem('portalUserSession', JSON.stringify(session))
      onLogin(session)
      onNavigate('student-portal')
      return
    }

    // Official login
    const errs = validateOfficialForm(
      officialForm.staffEmail,
      officialForm.password,
      officialForm.officeRole,
    )
    if (errs.length > 0) { setErrors(errs); return }

    // 'role' is stored alongside 'officeRole' for backward compatibility
    // with AdminDashboard's session reading until Phase 4 updates it.
    const session = {
      userType:   'official',
      staffEmail: officialForm.staffEmail.trim(),
      officeRole: officialForm.officeRole,
      role:       officialForm.officeRole,
    }
    localStorage.setItem('portalUserSession', JSON.stringify(session))
    onLogin(session)
    onNavigate('admin')
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Header */}
        <div className="login-card__header">
          <h1 className="login-card__title">Portal Login</h1>
          <p className="login-card__intro">
            Choose your access type to continue to the Student Registration Portal.
          </p>
        </div>

        <div className="login-card__body">

          {/* Step 1 — access type selection */}
          <p className="login-step-label">Step 1 — Select your access type</p>
          <div className="access-type-grid">

            <button
              type="button"
              className={`access-type-card${accessType === 'student' ? ' access-type-card--selected' : ''}`}
              onClick={() => handleAccessTypeChange('student')}
            >
              <svg className="access-type-card__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
              <span className="access-type-card__title">Student</span>
              <span className="access-type-card__desc">
                View your registration status and office clearances
              </span>
            </button>

            <button
              type="button"
              className={`access-type-card${accessType === 'official' ? ' access-type-card--selected' : ''}`}
              onClick={() => handleAccessTypeChange('official')}
            >
              <svg className="access-type-card__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 16.49 1 14.64 1c-1.04 0-1.96.52-2.64 1.32L12 2.7l-.36-.38C10.96 1.52 10.04 1 9 1 7.51 1 6 2.51 6 4.36c0 .48.1.92.18 1.36H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5.36-3c.96 0 1.72.78 1.72 1.72s-.76 1.72-1.72 1.72-1.72-.78-1.72-1.72.76-1.72 1.72-1.72zm-7.28 0c.96 0 1.72.78 1.72 1.72S8.32 6.44 7.36 6.44s-1.72-.78-1.72-1.72.76-1.72 1.72-1.72zM20 19H4v-2l8-5 8 5v2zm0-5.27L12 9 4 13.73V8h16v5.73z" />
              </svg>
              <span className="access-type-card__title">Official / Registrar Staff</span>
              <span className="access-type-card__desc">
                Review and process student registration applications
              </span>
            </button>

          </div>

          {/* Step 2 — student fields */}
          {accessType === 'student' && (
            <div className="login-form">
              <p className="login-step-label">Step 2 — Enter your student details</p>
              <LoginField
                label="Student ID or Email"
                type="text"
                name="identifier"
                value={studentForm.identifier}
                placeholder="e.g. 100123456 or jdoe@student.livingstone.edu"
                onChange={handleStudentChange}
              />
              <LoginField
                label="Password"
                type="password"
                name="password"
                value={studentForm.password}
                placeholder="Enter your password"
                onChange={handleStudentChange}
              />
            </div>
          )}

          {/* Step 2 — official fields */}
          {accessType === 'official' && (
            <div className="login-form">
              <p className="login-step-label">Step 2 — Enter your staff details</p>
              <LoginField
                label="Staff Email"
                type="email"
                name="staffEmail"
                value={officialForm.staffEmail}
                placeholder="e.g. jdoe@livingstone.edu"
                onChange={handleOfficialChange}
              />
              <LoginField
                label="Password"
                type="password"
                name="password"
                value={officialForm.password}
                placeholder="Enter your password"
                onChange={handleOfficialChange}
              />
              <label className="form-field">
                <span className="form-field__label">Office Role</span>
                <select
                  className="form-field__control"
                  name="officeRole"
                  value={officialForm.officeRole}
                  onChange={handleOfficialChange}
                >
                  <option value="">Select your office role</option>
                  {OFFICE_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Validation error summary */}
          {errors.length > 0 && (
            <div className="login-errors" role="alert">
              {errors.map((err, index) => (
                <p key={index} className="login-errors__item">{err}</p>
              ))}
            </div>
          )}

          {/* Submit — only shown once an access type is selected */}
          {accessType && (
            <button
              type="button"
              className="btn btn--primary login-card__submit"
              onClick={handleLogin}
            >
              {accessType === 'student'
                ? 'Continue to Student Portal'
                : 'Continue to Admin Dashboard'}
            </button>
          )}

        </div>
      </div>
    </div>
  )
}

export default Login
