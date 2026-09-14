import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TextField, SelectField } from './adminFormFields'
import { CLASSIFICATION_OPTIONS, RESIDENCY_OPTIONS, ACCOUNT_STATUS_OPTIONS } from './adminConstants'
import { createStudentAccount, updateStudentAccount, getAdminStudent, isMissingEndpoint } from '../../services/adminApi'
import MissingEndpointNotice from './MissingEndpointNotice'

// Mirrors the backend's own format rules exactly (auth.py _STUDENT_ID_RE /
// _STUDENT_EMAIL_SUFFIX and students.ck_students_student_no_format) so a
// client-side error never contradicts what the server would say.
const STUDENT_ID_RE = /^100[0-9]{6}$/
const STUDENT_EMAIL_SUFFIX = '@student.livingstone.edu'

function emptyForm() {
  return {
    student_no: '',
    first_name: '',
    last_name: '',
    livingstone_email: '',
    major: '',
    classification: '',
    residency_type: 'residential',
    is_active: true,
  }
}

function validate(form) {
  const errors = {}
  if (!form.student_no.trim()) errors.student_no = 'Student ID is required.'
  else if (!STUDENT_ID_RE.test(form.student_no.trim())) errors.student_no = 'Student ID must be "100" followed by 6 digits (e.g. 100123456).'

  if (!form.first_name.trim()) errors.first_name = 'First name is required.'
  if (!form.last_name.trim()) errors.last_name = 'Last name is required.'

  const email = form.livingstone_email.trim().toLowerCase()
  if (!email) errors.livingstone_email = 'College email is required.'
  else if (!email.endsWith(STUDENT_EMAIL_SUFFIX)) errors.livingstone_email = `College email must end with ${STUDENT_EMAIL_SUFFIX}.`

  if (!form.residency_type) errors.residency_type = 'Residency type is required.'

  return errors
}

/* -------------------------------------------------------
   AdminStudentForm — Add Student (mode="create") and Edit Student
   (mode="edit"). Fields are limited to what the Student model
   actually stores (student_no, first_name, last_name,
   livingstone_email, major, classification, residency_type) plus
   users.is_active — see the implementation report for why
   "Registration semester" from the task's example field list is not
   included (Student has no such column; that data lives on
   Application.term_code/academic_year instead, one per registration).
------------------------------------------------------- */
function AdminStudentForm({ mode, onNavigate }) {
  const { studentId } = useParams()
  const isEdit = mode === 'edit'

  const [form, setForm]         = useState(emptyForm())
  const [errors, setErrors]     = useState({})
  const [touchedSubmit, setTouchedSubmit] = useState(false)

  const [loading, setLoading]       = useState(isEdit)
  const [loadMissing, setLoadMissing] = useState(false)
  const [loadError, setLoadError]     = useState('')

  const [submitting, setSubmitting]   = useState(false)
  const [submitMissing, setSubmitMissing] = useState(false)
  const [submitError, setSubmitError]     = useState('')
  const [success, setSuccess]             = useState('')

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    async function run() {
      setLoading(true)
      setLoadMissing(false)
      setLoadError('')
      try {
        const data = await getAdminStudent(studentId)
        if (!cancelled) setForm({ ...emptyForm(), ...data, is_active: data.is_active ?? true })
      } catch (err) {
        if (cancelled) return
        if (isMissingEndpoint(err)) setLoadMissing(true)
        else setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [isEdit, studentId])

  const fieldProps = (key) => ({
    value: form[key],
    onChange: (value) => setForm((f) => ({ ...f, [key]: value })),
    error: touchedSubmit ? errors[key] : undefined,
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    setTouchedSubmit(true)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setSubmitMissing(false)
    setSubmitError('')
    const payload = {
      student_no: form.student_no.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      livingstone_email: form.livingstone_email.trim().toLowerCase(),
      major: form.major.trim() || null,
      classification: form.classification || null,
      residency_type: form.residency_type,
      ...(isEdit ? { is_active: form.is_active } : {}),
    }
    try {
      if (isEdit) await updateStudentAccount(studentId, payload)
      else await createStudentAccount(payload)
      setSuccess(isEdit ? 'Student account updated successfully.' : 'Student account created successfully.')
    } catch (err) {
      if (isMissingEndpoint(err)) {
        setSubmitMissing(true)
      } else if (err.status === 409) {
        setErrors((prev) => ({
          ...prev,
          student_no: 'This student ID is already registered.',
          livingstone_email: 'This college email is already registered.',
        }))
        setTouchedSubmit(true)
        setSubmitError(err.message || 'This student ID or email is already registered.')
      } else {
        setSubmitError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const errorList = touchedSubmit ? Object.values(errors) : []

  return (
    <div className="admin-form-page">
      <button type="button" className="workspace-back" onClick={() => onNavigate('/admin/users')}>
        ← Back to User Management
      </button>

      <div>
        <h1 className="workspace-hero__title">{isEdit ? 'Edit Student' : 'Add Student'}</h1>
        <p className="workspace-hero__subtitle">
          {isEdit ? 'Update this student’s account information.' : 'Create a new student account.'}
        </p>
      </div>

      {isEdit && loading && <p className="app-detail__empty">Loading student…</p>}
      {isEdit && loadMissing && (
        <MissingEndpointNotice endpoint={`GET /admin/students/${studentId}`} />
      )}
      {isEdit && loadError && (
        <div className="workspace-error" role="alert">
          <span className="workspace-error__icon" aria-hidden="true">!</span>
          <div className="workspace-error__body">
            <span className="workspace-error__title">Could not load this student</span>
            <p className="workspace-error__text">{loadError}</p>
          </div>
        </div>
      )}

      {(!isEdit || (!loading && !loadMissing && !loadError)) && !success && (
        <form className="form-section" onSubmit={handleSubmit} noValidate>
          {errorList.length > 0 && (
            <div className="validation-summary" role="alert">
              <p className="validation-summary__heading">Please fix the following before continuing:</p>
              <ul className="validation-summary__list">
                {errorList.map((msg) => <li key={msg} className="validation-summary__item">{msg}</li>)}
              </ul>
            </div>
          )}

          <div className="form-grid">
            <TextField label="Student ID" required placeholder="100123456" {...fieldProps('student_no')} />
            <TextField label="First Name" required {...fieldProps('first_name')} />
            <TextField label="Last Name" required {...fieldProps('last_name')} />
            <TextField label="College Email" type="email" required placeholder="student@student.livingstone.edu" {...fieldProps('livingstone_email')} />
            <TextField label="Major" {...fieldProps('major')} />
            <SelectField label="Classification" options={CLASSIFICATION_OPTIONS} {...fieldProps('classification')} />
            <SelectField label="Residency" required options={RESIDENCY_OPTIONS} {...fieldProps('residency_type')} />
            {isEdit && (
              <SelectField
                label="Account Status"
                required
                options={ACCOUNT_STATUS_OPTIONS}
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(value) => setForm((f) => ({ ...f, is_active: value === 'active' }))}
              />
            )}
          </div>

          <p className="admin-form-note">
            "Registration semester" is not a Student field in the backend — a student's term/academic
            year is recorded per registration application (term_code / academic_year), not on their
            profile, so it isn't editable here.
            {!isEdit && (
              <>
                {' '}A temporary password or invitation email is not yet supported by the backend —
                this account cannot sign in until that capability is added (see the implementation report).
              </>
            )}
          </p>

          {submitMissing && (
            <MissingEndpointNotice
              title="This can’t be saved yet"
              endpoint={isEdit ? `PATCH /admin/students/${studentId}` : 'POST /admin/students'}
            />
          )}
          {submitError && <p className="form-status form-status--error" role="alert">{submitError}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn--outline" onClick={() => onNavigate('/admin/users')} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Student'}
            </button>
          </div>
        </form>
      )}

      {success && (
        <div className="form-section">
          <p className="form-status form-status--success" role="status">{success}</p>
          <div className="form-actions">
            <button type="button" className="btn btn--primary" onClick={() => onNavigate('/admin/users')}>
              Back to User Management
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminStudentForm
