import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TextField, SelectField } from './adminFormFields'
import { OFFICE_ROLE_OPTIONS, ACCOUNT_STATUS_OPTIONS } from './adminConstants'
import { createOfficialAccount, updateUser } from '../../services/adminApi'

// Mirrors the backend's own staff-email rule (auth.py _find_user): must
// end in @livingstone.edu but NOT be a student address.
const STAFF_EMAIL_SUFFIX = '@livingstone.edu'
const STUDENT_EMAIL_SUFFIX = '@student.livingstone.edu'

function emptyForm() {
  return {
    first_name: '', last_name: '', school_email: '', office_phone: '',
    primary_office: '', is_active: true,
  }
}

// Prefills from the row User Management already has (see
// UserManagementPage.handleEdit) — there is no GET /admin/users/{id} to
// fetch a single official by id. office_phone isn't part of that row
// (AdminUserListItem has no such field), so it starts blank and is left
// out of the PATCH payload unless the admin explicitly fills it in —
// see buildUpdatePayload.
function formFromUserRow(user) {
  return {
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    school_email: user.email || '',
    office_phone: '',
    primary_office: user.office || '',
    is_active: user.is_active,
  }
}

function validate(form, isEdit) {
  const errors = {}
  if (!form.first_name.trim()) errors.first_name = 'First name is required.'
  if (!form.last_name.trim()) errors.last_name = 'Last name is required.'

  const email = form.school_email.trim().toLowerCase()
  if (!email) errors.school_email = 'College email is required.'
  else if (email.endsWith(STUDENT_EMAIL_SUFFIX) || !email.endsWith(STAFF_EMAIL_SUFFIX)) {
    errors.school_email = `Staff email must end with ${STAFF_EMAIL_SUFFIX} (not a student address).`
  }

  if (!isEdit && !form.primary_office) {
    errors.primary_office = 'A primary office is required — an official can only have one.'
  }

  return errors
}

// Edit mode only sends fields the admin actually filled in — office_phone
// starts blank because its real current value is unknown here (see
// formFromUserRow), so an untouched blank field is never sent as a
// clearing PATCH. Office is never sent from this form at all — it has
// its own confirmation-gated endpoint (Office Assignments).
function buildUpdatePayload(form) {
  const payload = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    email: form.school_email.trim().toLowerCase(),
    is_active: form.is_active,
  }
  if (form.office_phone.trim()) payload.office_phone = form.office_phone.trim()
  return payload
}

/* -------------------------------------------------------
   AdminOfficialForm — Add Official (mode="create") and Edit Official
   (mode="edit"). Fields are limited to what the Official model
   actually stores (staff_email, first_name, last_name, office_phone)
   plus users.is_active. Office is set once at creation only — changing
   it afterward goes through the dedicated, confirmation-gated Office
   Assignments screen (PUT /admin/officials/{id}/office), not this form.
   The Official model has no human-readable employee/official ID
   column (only an internal UUID), so that field from the task's
   example list is intentionally omitted — see the implementation report.
------------------------------------------------------- */
function AdminOfficialForm({ mode, onNavigate }) {
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
        setSuccess('Official account updated successfully.')
      } else {
        const created = await createOfficialAccount({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          school_email: form.school_email.trim().toLowerCase(),
          office_phone: form.office_phone.trim() || null,
          primary_office: form.primary_office,
        })
        setTemporaryPassword(created.temporary_password)
        setSuccess('Official account created successfully.')
      }
    } catch (err) {
      if (err.status === 409) {
        setErrors((prev) => ({ ...prev, school_email: 'This college email is already registered.' }))
        setTouchedSubmit(true)
        setSubmitError(err.message || 'This college email is already registered.')
      } else {
        setSubmitError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const errorList = touchedSubmit ? Object.values(errors) : []

  // Edit mode reached without router state (a bookmark, a page refresh) —
  // there is no by-id endpoint to recover from that.
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
            link or page refresh (there is no lookup-by-id endpoint yet). Find the official in User
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
        <h1 className="workspace-hero__title">{isEdit ? 'Edit Official' : 'Add Official'}</h1>
        <p className="workspace-hero__subtitle">
          {isEdit ? 'Update this official’s account information.' : 'Create a new office-staff account.'}
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
            <TextField label="First Name" required {...fieldProps('first_name')} />
            <TextField label="Last Name" required {...fieldProps('last_name')} />
            <TextField label="College Email" type="email" required placeholder="name@livingstone.edu" {...fieldProps('school_email')} />
            <TextField
              label="Office Phone" type="tel" {...fieldProps('office_phone')}
              help={isEdit ? 'Leave blank to keep the current value (not shown here).' : undefined}
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

          {isEdit ? (
            <p className="admin-form-note">
              Current office: <strong>{form.primary_office || '—'}</strong>. Office assignment isn't
              changed from this form — use Office Assignments, which requires confirmation before
              reassigning an official.
            </p>
          ) : (
            <div className="form-field">
              <span className="form-field__label">Primary Office <span aria-hidden="true">*</span></span>
              <p className="reg-field__help">An official can be assigned to only one primary office.</p>
              <div className="admin-radio-grid" role="radiogroup" aria-label="Primary office">
                {OFFICE_ROLE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="admin-radio-option">
                    <input
                      type="radio"
                      name="primary_office"
                      value={opt.value}
                      checked={form.primary_office === opt.value}
                      onChange={() => setForm((f) => ({ ...f, primary_office: opt.value }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {touchedSubmit && errors.primary_office && (
                <p className="admin-field-error" role="alert">{errors.primary_office}</p>
              )}
            </div>
          )}

          <p className="admin-form-note">
            There is no employee/official ID field on the backend's Official model (only an internal
            record ID) — this form does not include one, per the task's "when supported" guidance.
            {!isEdit && (
              <>
                {' '}This account is created with a temporary password shown once on the next screen —
                share it with the official through a secure channel. They must change it on first login
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
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Official'}
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
              This is shown once. Share it with the official through a secure channel — they'll be
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

export default AdminOfficialForm
