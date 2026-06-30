import { useState } from 'react'
import { OFFICE_ROLES } from '../utils/registrationWorkflow'

// This is a frontend-only session used for the prototype.
// Real authentication will be handled by the backend later.

/* -------------------------------------------------------
   Field definitions for each form type
------------------------------------------------------- */
const STUDENT_FIELDS = [
  {
    name:        'studentId',
    label:       'Student ID',
    type:        'text',
    placeholder: 'e.g. LC001245',
  },
  {
    name:        'email',
    label:       'Email Address',
    type:        'email',
    placeholder: 'e.g. student@livingstone.edu',
  },
]

const OFFICIAL_FIELDS = [
  {
    name:        'staffName',
    label:       'Staff Name',
    type:        'text',
    placeholder: 'e.g. Dr. Morgan Lee',
  },
  {
    name:        'staffEmail',
    label:       'Staff Email',
    type:        'email',
    placeholder: 'e.g. staff@livingstone.edu',
  },
]

/* -------------------------------------------------------
   isEduEmail — checks that an email ends with .edu.
   Keeps it simple: .edu suffix only, no domain restriction yet.
------------------------------------------------------- */
function isEduEmail(email) {
  return email.trim().toLowerCase().endsWith('.edu')
}

/* -------------------------------------------------------
   Reusable text/email input — reuses .form-field styles
------------------------------------------------------- */
function LoginField({ field, value, onChange }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{field.label}</span>
      <input
        className="form-field__control"
        type={field.type}
        name={field.name}
        value={value}
        placeholder={field.placeholder}
        onChange={onChange}
        autoComplete="off"
      />
    </label>
  )
}

/* -------------------------------------------------------
   Login — main page component
------------------------------------------------------- */
function Login({ onNavigate, onLogin }) {
  // 'student' | 'official' | '' (nothing selected yet)
  const [accessType, setAccessType] = useState('')

  const [formData, setFormData] = useState({
    studentId:  '',
    email:      '',
    staffName:  '',
    staffEmail: '',
    officeRole: '',
  })

  const [errors, setErrors] = useState([])

  const handleAccessTypeChange = (type) => {
    setAccessType(type)
    setErrors([])
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Returns an array of error strings.
  // An empty array means the form is valid.
  const validateLoginForm = () => {
    const errs = []

    if (!accessType) {
      errs.push('Please select an access type to continue.')
      return errs
    }

    if (accessType === 'student') {
      if (!formData.studentId.trim()) {
        errs.push('Student ID is required.')
      }
      if (!formData.email.trim()) {
        errs.push('Email is required.')
      } else if (!isEduEmail(formData.email)) {
        errs.push('Please use your official school email ending in .edu.')
      }
    }

    if (accessType === 'official') {
      if (!formData.staffName.trim()) {
        errs.push('Staff Name is required.')
      }
      if (!formData.staffEmail.trim()) {
        errs.push('Staff Email is required.')
      } else if (!isEduEmail(formData.staffEmail)) {
        errs.push('Please use your official staff email ending in .edu.')
      }
      if (!formData.officeRole) {
        errs.push('Please select an Office Role.')
      }
    }

    return errs
  }

  const handleLogin = () => {
    const errs = validateLoginForm()

    if (errs.length > 0) {
      setErrors(errs)
      return
    }

    let session

    if (accessType === 'student') {
      session = {
        userType:  'student',
        studentId: formData.studentId.trim(),
        email:     formData.email.trim(),
      }
      localStorage.setItem('portalUserSession', JSON.stringify(session))
      onLogin(session)
      onNavigate('student-portal')
      return
    }

    // Officials choose an office role so the dashboard can apply role-based permissions.
    // We also store 'role' alongside 'officeRole' for compatibility with AdminDashboard.
    session = {
      userType:   'official',
      staffName:  formData.staffName.trim(),
      staffEmail: formData.staffEmail.trim(),
      officeRole: formData.officeRole,
      role:       formData.officeRole,
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

        {/* Body */}
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

          {/* Step 2 — form fields based on access type */}
          {accessType === 'student' && (
            <div className="login-form">
              <p className="login-step-label">Step 2 — Enter your student details</p>
              {STUDENT_FIELDS.map((field) => (
                <LoginField
                  key={field.name}
                  field={field}
                  value={formData[field.name]}
                  onChange={handleFieldChange}
                />
              ))}
            </div>
          )}

          {accessType === 'official' && (
            <div className="login-form">
              <p className="login-step-label">Step 2 — Enter your staff details</p>
              {OFFICIAL_FIELDS.map((field) => (
                <LoginField
                  key={field.name}
                  field={field}
                  value={formData[field.name]}
                  onChange={handleFieldChange}
                />
              ))}

              {/* Office role — officials must select the office they belong to */}
              <label className="form-field">
                <span className="form-field__label">Office Role</span>
                <select
                  className="form-field__control"
                  name="officeRole"
                  value={formData.officeRole}
                  onChange={handleFieldChange}
                >
                  <option value="">Select your office role</option>
                  {OFFICE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Validation error summary */}
          {errors.length > 0 && (
            <div className="login-errors" role="alert">
              {errors.map((err, index) => (
                <p key={index} className="login-errors__item">
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Submit — only shown once access type is chosen */}
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
