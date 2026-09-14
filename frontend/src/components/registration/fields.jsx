/* -------------------------------------------------------
   Small reusable field primitives shared by every wizard step.
   Kept separate from StudentForm's FormField so the two forms can
   evolve independently (see registrationAdapter.js header comment).
------------------------------------------------------- */
import { useId } from 'react'

export function TextField({ label, value, onChange, type = 'text', placeholder, required, readOnly, help }) {
  const id = useId()
  return (
    <label className="reg-field" htmlFor={id}>
      <span className="reg-field__label">
        {label}
        {required && <span className="reg-field__required" aria-hidden="true"> *</span>}
      </span>
      <input
        id={id}
        className="reg-field__control"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      {help && <span className="reg-field__help" id={`${id}-help`}>{help}</span>}
    </label>
  )
}

export function SelectField({ label, value, onChange, options, required, help }) {
  const id = useId()
  return (
    <label className="reg-field" htmlFor={id}>
      <span className="reg-field__label">
        {label}
        {required && <span className="reg-field__required" aria-hidden="true"> *</span>}
      </span>
      <select
        id={id}
        className="reg-field__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-describedby={help ? `${id}-help` : undefined}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {help && <span className="reg-field__help" id={`${id}-help`}>{help}</span>}
    </label>
  )
}

export function TextAreaField({ label, value, onChange, placeholder, help }) {
  const id = useId()
  return (
    <label className="reg-field reg-field--wide" htmlFor={id}>
      <span className="reg-field__label">{label}</span>
      <textarea
        id={id}
        className="reg-field__control reg-field__control--textarea"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      {help && <span className="reg-field__help" id={`${id}-help`}>{help}</span>}
    </label>
  )
}
