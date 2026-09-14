import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TextField, SelectField } from './adminFormFields'
import { CLASSIFICATION_OPTIONS, RESIDENCY_OPTIONS, ACCOUNT_STATUS_OPTIONS } from './adminConstants'
import { createStudentAccount, updateUser } from '../../services/adminApi'

// Mirrors the backend's own format rules exactly (auth.py _STUDENT_ID_RE /
// _STUDENT_EMAIL_SUFFIX and students.ck_students_student_no_format) so a
// client-side error never contradicts what the server would say.
const STUDENT_ID_RE = /^100[0-9]{6}$/
const STUDENT_EMAIL_SUFFIX = '@student.livingstone.edu'

function emptyForm() {
  return {
    student_id: '',
    first_name: '',
    last_name: '',
    school_email: '',
    major: '',
    classification: '',
    residency_type: 'residential',
    is_active: true,
  }
}

// Prefills from the row User Management already has (see
// UserManagementPage.handleEdit) — there is no GET /admin/users/{id} to
// fetch a single student by id, so the row passed via router state is
// the only source of truth for editing. That row does NOT include
// major/classification/residency_type (AdminUserListItem has no such
// fields), so those three start blank/unset here and are left OUT of
// the PATCH payload unless the admin explicitly fills them in — see
// buildUpdatePayload. Leaving them blank must never silently clear a
// value the admin never saw or touched.
function formFromUserRow(user) {
  return {
    student_id: user.id_number || '',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    school_email: user.email || '',
    major: '',
    classification: '',
    residency_type: '',
    is_active: user.is_active,
  }
}

function validate(form, isEdit) {
  const errors = {}
  if (!isEdit) {
    if (!form.student_id.trim()) errors.student_id = 'Student ID is required.'
    else if (!STUDENT_ID_RE.test(form.student_id.trim())) errors.student_id = 'Student ID must be "100" followed by 6 digits (e.g. 100123456).'
  }

  if (!form.first_name.trim()) errors.first_name = 'First name is required.'
  if (!form.last_name.trim()) errors.last_name = 'Last name is required.'

  const email = form.school_email.trim().toLowerCase()
  if (!email) errors.school_email = 'College email is required.'
  else if (!email.endsWith(STUDENT_EMAIL_SUFFIX)) errors.school_email = `College email must end with ${STUDENT_EMAIL_SUFFIX}.`

  // Required on create (a real value must be chosen); optional on edit —
  // blank there means "leave unchanged" (see buildUpdatePayload), not
  // "not required".
  if (!isEdit && !form.residency_type) errors.residency_type = 'Residency type is required.'

  return errors
}

// Edit mode only sends fields the admin actually filled in — major,
// classification, and residency_type start blank (see formFromUserRow's
// docstring) precisely because their real current value is unknown here,
// so an untouched blank field must never be sent as a clearing PATCH.
function buildUpdatePayload(form) {
  const payload = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    email: form.school_email.trim().toLowerCase(),
    is_active: form.is_active,
  }
  if (form.major.trim()) payload.major = form.major.trim()
  if (form.classification) payload.classification = form.classification
  if (form.residency_type) payload.residency_type = form.residency_type
  return payload
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
  const location = useLocation()
  const isEdit = mode === 'edit'
  const editUser = isEdit ? location.state?.user : null

  const [form, setForm]         = useState(() => (editUser ? formFromUserRow(editUser) : emptyForm()))
  const [errors, setErrors]     = useState({})
  const [touchedSubmit, setTouchedSubmit] = useState(false)

  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess]         = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')

  const fieldProps = (key) => ({
    value: form[key],
    onChange: (value) => setForm((f) => ({ ...f, [key]: value })),
    error: touchedSubmit ? errors[key] : undefined,
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(form, isEdit)
    setErrors(nextErrors)
    setTouchedSubmit(true)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setSubmitError('')
    try {
      if (isEdit) {
        await updateUser(editUser.user_id, buildUpdatePayload(form))
        setSuccess('Student account updated successfully.')
      } else {
        const created = await createStudentAccount({
          student_id: form.student_id.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          school_email: form.school_email.trim().toLowerCase(),
          major: form.major.trim() || null,
          classification: form.classification || null,
          residency_type: form.residency_type,
        })
        setTemporaryPassword(created.temporary_password)
        setSuccess('Student account created successfully.')
      }
    } catch (err) {
      if (err.status === 409) {
        setErrors((prev) => ({
          ...prev,
          student_id: 'This student ID is already registered.',
          school_email: 'This college email is already registered.',
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

  // Edit mode reached without router state (a bookmark, a page refresh) —
  // there is no by-id endpoint to recover from that, so send the admin
  // back to look the account up again instead of showing a blank form
  // that would silently overwrite fields on save.
  if (isEdit && !editUser) {
    return (
      <div className="admin-form-page">
        <button type="button" className="workspace-back" onClick={() => onNavigate('/admin/users')}>
          ← Back to User Management
        </button>
        <div className="workspace-empty">
          <h3 className="workspace-empty__title">Open this from User Management</h3>
          <p className="workspace-empty__text">
            This edit page needs the account's current details, which aren't available from a direct
            link or page refresh (there is no lookup-by-id endpoint yet). Find the student in User
            Management and choose Edit from there.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => onNavigate('/admin/users')}>
            Go to User Management
          </button>
        </div>
      </div>
    )
  }

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

      {!success && (
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
            <TextField
              label="Student ID" required={!isEdit} disabled={isEdit}
              placeholder="100123456" {...fieldProps('student_id')}
              help={isEdit ? 'Student ID cannot be changed once created.' : undefined}
            />
            <TextField label="First Name" required {...fieldProps('first_name')} />
            <TextField label="Last Name" required {...fieldProps('last_name')} />
            <TextField label="College Email" type="email" required placeholder="student@student.livingstone.edu" {...fieldProps('school_email')} />
            <TextField
              label="Major" {...fieldProps('major')}
              help={isEdit ? 'Leave blank to keep the current value (not shown here).' : undefined}
            />
            <SelectField
              label="Classification" options={CLASSIFICATION_OPTIONS} {...fieldProps('classification')}
              placeholder={isEdit ? 'Leave unchanged' : undefined}
            />
            <SelectField
              label="Residency" required={!isEdit} options={RESIDENCY_OPTIONS} {...fieldProps('residency_type')}
              placeholder={isEdit ? 'Leave unchanged' : undefined}
            />
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
                {' '}This account is created with a temporary password shown once on the next screen —
                share it with the student through a secure channel. They must change it on first login
                (must_change_password).
              </>
            )}
          </p>

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
          {temporaryPassword && (
            <div className="admin-form-note" role="status">
              <strong>Temporary password:</strong> <code>{temporaryPassword}</code>
              <br />
              This is shown once. Share it with the student through a secure channel — they'll be
              required to change it the first time they sign in.
            </div>
          )}
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
