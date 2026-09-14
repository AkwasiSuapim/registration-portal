import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TextField, SelectField } from './adminFormFields'
import { OFFICE_ROLE_OPTIONS, ACCOUNT_STATUS_OPTIONS } from './adminConstants'
import { createOfficialAccount, updateOfficialAccount, getAdminOfficial, isMissingEndpoint } from '../../services/adminApi'
import MissingEndpointNotice from './MissingEndpointNotice'

// Mirrors the backend's own staff-email rule (auth.py _find_user): must
// end in @livingstone.edu but NOT be a student address.
const STAFF_EMAIL_SUFFIX = '@livingstone.edu'
const STUDENT_EMAIL_SUFFIX = '@student.livingstone.edu'

function emptyForm() {
  return {
    first_name: '', last_name: '', staff_email: '', office_phone: '',
    office_role_key: '', is_active: true,
  }
}

function validate(form) {
  const errors = {}
  if (!form.first_name.trim()) errors.first_name = 'First name is required.'
  if (!form.last_name.trim()) errors.last_name = 'Last name is required.'

  const email = form.staff_email.trim().toLowerCase()
  if (!email) errors.staff_email = 'College email is required.'
  else if (email.endsWith(STUDENT_EMAIL_SUFFIX) || !email.endsWith(STAFF_EMAIL_SUFFIX)) {
    errors.staff_email = `Staff email must end with ${STAFF_EMAIL_SUFFIX} (not a student address).`
  }

  if (!form.office_role_key) errors.office_role_key = 'A primary office is required — an official can only have one.'

  return errors
}

/* -------------------------------------------------------
   AdminOfficialForm — Add Official (mode="create") and Edit Official
   (mode="edit"). Fields are limited to what the Official model
   actually stores (staff_email, first_name, last_name, office_phone)
   plus the office role assignment (users.role_id) and users.is_active.
   The Official model has no human-readable employee/official ID
   column (only an internal UUID), so that field from the task's
   example list is intentionally omitted — see the implementation report.
------------------------------------------------------- */
function AdminOfficialForm({ mode, onNavigate }) {
  const { officialId } = useParams()
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
        const data = await getAdminOfficial(officialId)
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
  }, [isEdit, officialId])

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
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      staff_email: form.staff_email.trim().toLowerCase(),
      office_phone: form.office_phone.trim() || null,
      office_role_key: form.office_role_key,
      ...(isEdit ? { is_active: form.is_active } : {}),
    }
    try {
      if (isEdit) await updateOfficialAccount(officialId, payload)
      else await createOfficialAccount(payload)
      setSuccess(isEdit ? 'Official account updated successfully.' : 'Official account created successfully.')
    } catch (err) {
      if (isMissingEndpoint(err)) {
        setSubmitMissing(true)
      } else if (err.status === 409) {
        setErrors((prev) => ({ ...prev, staff_email: 'This college email is already registered.' }))
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

      {isEdit && loading && <p className="app-detail__empty">Loading official…</p>}
      {isEdit && loadMissing && (
        <MissingEndpointNotice endpoint={`GET /admin/officials/${officialId}`} />
      )}
      {isEdit && loadError && (
        <div className="workspace-error" role="alert">
          <span className="workspace-error__icon" aria-hidden="true">!</span>
          <div className="workspace-error__body">
            <span className="workspace-error__title">Could not load this official</span>
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
            <TextField label="First Name" required {...fieldProps('first_name')} />
            <TextField label="Last Name" required {...fieldProps('last_name')} />
            <TextField label="College Email" type="email" required placeholder="name@livingstone.edu" {...fieldProps('staff_email')} />
            <TextField label="Office Phone" type="tel" {...fieldProps('office_phone')} />
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

          <div className="form-field">
            <span className="form-field__label">Primary Office <span aria-hidden="true">*</span></span>
            <p className="reg-field__help">An official can be assigned to only one primary office.</p>
            <div className="admin-radio-grid" role="radiogroup" aria-label="Primary office">
              {OFFICE_ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="admin-radio-option">
                  <input
                    type="radio"
                    name="office_role_key"
                    value={opt.value}
                    checked={form.office_role_key === opt.value}
                    onChange={() => setForm((f) => ({ ...f, office_role_key: opt.value }))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {touchedSubmit && errors.office_role_key && (
              <p className="admin-field-error" role="alert">{errors.office_role_key}</p>
            )}
          </div>

          <p className="admin-form-note">
            There is no employee/official ID field on the backend's Official model (only an internal
            record ID) — this form does not include one, per the task's "when supported" guidance.
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
              endpoint={isEdit ? `PATCH /admin/officials/${officialId}` : 'POST /admin/officials'}
            />
          )}
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
