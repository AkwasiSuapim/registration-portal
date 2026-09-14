import { useId, useRef } from 'react'
import { validateFileSelection, ALLOWED_UPLOAD_EXTENSIONS } from './wizardConfig'

function formatFileSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* -------------------------------------------------------
   FileUploadField — one reusable upload control used across every
   step. Slot shape: { file, name, size, status, error, documentId }
   status: 'selected' (chosen locally, not sent yet) | 'uploading' |
           'uploaded' (confirmed by the server) | 'error'

   Uploads only reach the server once the application is created at
   final submission (see registrationAdapter.js) — before that, this
   field shows a clearly-labeled local "Selected" state rather than
   claiming anything was saved.
------------------------------------------------------- */
function FileUploadField({ label, required, helpText, accept, slot, onSelect, onRemove, disabled }) {
  const inputRef = useRef(null)
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`

  const status = slot?.status || 'empty'

  const handleChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-selecting the same file after Remove
    if (!file) return
    const validationError = validateFileSelection(file)
    if (validationError) {
      onSelect(null, validationError)
      return
    }
    onSelect(file, null)
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div className="reg-upload">
      <div className="reg-upload__label-row">
        <span className="reg-upload__label" id={`${fieldId}-label`}>
          {label}
          {required && <span className="reg-upload__required" aria-hidden="true"> *</span>}
        </span>
        {status === 'uploaded' && <span className="reg-upload__badge reg-upload__badge--success">Uploaded</span>}
        {status === 'selected' && <span className="reg-upload__badge reg-upload__badge--pending">Selected</span>}
        {status === 'uploading' && <span className="reg-upload__badge reg-upload__badge--pending">Uploading…</span>}
        {status === 'error' && <span className="reg-upload__badge reg-upload__badge--error">Error</span>}
        {status === 'empty' && required && <span className="reg-upload__badge reg-upload__badge--muted">Not uploaded</span>}
      </div>

      {helpText && <p className="reg-upload__help" id={helpId}>{helpText}</p>}

      {/* Visually hidden and out of the tab order — the visible "Choose
          File" / "Replace" button above is what keyboard users focus and
          activate; it forwards the click to this input via inputRef so a
          focus ring is never applied to an invisible element. */}
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        tabIndex={-1}
        id={fieldId}
        accept={accept || ALLOWED_UPLOAD_EXTENSIONS.join(',')}
        onChange={handleChange}
        disabled={disabled || status === 'uploading'}
        aria-labelledby={`${fieldId}-label`}
        aria-describedby={[helpText ? helpId : null, status === 'error' ? errorId : null].filter(Boolean).join(' ') || undefined}
      />

      <div className="reg-upload__body">
        {(status === 'empty' || (status === 'error' && !slot?.name)) && (
          <button
            type="button"
            className="btn btn--outline btn--small"
            onClick={openPicker}
            disabled={disabled || status === 'uploading'}
          >
            Choose File
          </button>
        )}

        {slot?.name && (status === 'selected' || status === 'uploading' || status === 'uploaded' || status === 'error') && (
          <div className="reg-upload__file">
            <span className="reg-upload__filename">{slot.name}</span>
            {slot.size != null && <span className="reg-upload__filesize">{formatFileSize(slot.size)}</span>}
            <div className="reg-upload__actions">
              <button
                type="button"
                className="btn btn--outline btn--small"
                onClick={openPicker}
                disabled={disabled || status === 'uploading'}
              >
                Replace
              </button>
              {status !== 'uploaded' && (
                <button
                  type="button"
                  className="btn btn--outline btn--small reg-upload__remove"
                  onClick={onRemove}
                  disabled={disabled || status === 'uploading'}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {status === 'error' && (
        <p className="reg-upload__error" id={errorId} role="alert">{slot.error}</p>
      )}
    </div>
  )
}

export default FileUploadField
