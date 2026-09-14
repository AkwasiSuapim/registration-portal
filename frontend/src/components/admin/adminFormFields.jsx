/* -------------------------------------------------------
   adminFormFields.jsx
   -----------------------
   Small field primitives for the Add/Edit Student and Add/Edit
   Official forms. Reuses the shared form-field / form-field__label /
   form-field__control / form-grid classes already defined in App.css
   (the same ones the student-facing form used) rather than
   introducing a new input style — this file only adds a field-level
   error message (admin-field-error, adminWorkspace.css) and the
   aria-invalid/aria-describedby wiring the registration wizard's own
   fields.jsx primitives don't need.
------------------------------------------------------- */
import { useId } from 'react'

export function TextField({ label, value, onChange, type = 'text', placeholder, required, disabled, help, error }) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  const helpId = help ? `${id}-help` : undefined
  return (
    <label className="form-field" htmlFor={id}>
      <span className="form-field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        id={id}
        className="form-field__control"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={[errorId, helpId].filter(Boolean).join(' ') || undefined}
      />
      {help && <span className="reg-field__help" id={helpId}>{help}</span>}
      {error && <p className="admin-field-error" id={errorId} role="alert">{error}</p>}
    </label>
  )
}

export function SelectField({ label, value, onChange, options, required, disabled, placeholder, error }) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  return (
    <label className="form-field" htmlFor={id}>
      <span className="form-field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <select
        id={id}
        className="form-field__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      >
        <option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>
        ))}
      </select>
      {error && <p className="admin-field-error" id={errorId} role="alert">{error}</p>}
    </label>
  )
}
