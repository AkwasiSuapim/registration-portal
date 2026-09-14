import { TextField } from '../fields'
import FileUploadField from '../FileUploadField'

// Step 5 — Business Office and Cashier.
//
// The Presidential Scholar financial statement is provided by the
// Business Office, not uploaded by the student — this step only shows
// a placeholder for it and captures the student's typed full legal
// name as their signature. The backend has no e-signature field today,
// so that name is kept in this session only and reported as missing
// API support at the end of the feature summary.
function BusinessOfficeStep({ state, updateSection, updateUploadSlot }) {
  const { businessOffice } = state
  const isScholar = businessOffice.isPresidentialScholar === 'yes'
  const isNotScholar = businessOffice.isPresidentialScholar === 'no'

  return (
    <fieldset className="reg-fieldset">
      <legend className="reg-fieldset__legend">Are you a Presidential Scholar?</legend>

      <div className="reg-radio-group" role="radiogroup" aria-label="Are you a Presidential Scholar?">
        <label className="reg-radio">
          <input
            type="radio"
            name="presidential-scholar"
            checked={isScholar}
            onChange={() => updateSection('businessOffice', { isPresidentialScholar: 'yes' })}
          />
          Yes, I am a Presidential Scholar
        </label>
        <label className="reg-radio">
          <input
            type="radio"
            name="presidential-scholar"
            checked={isNotScholar}
            onChange={() => updateSection('businessOffice', { isPresidentialScholar: 'no' })}
          />
          No
        </label>
      </div>

      {isScholar && (
        <div className="reg-subsection">
          <div className="reg-placeholder">
            <span className="reg-placeholder__title">Presidential Scholar financial statement</span>
            <p className="reg-placeholder__text">
              The Business Office provides this document directly — it is not uploaded by you, and
              can be replaced there later if it needs to change.
            </p>
          </div>
          <TextField
            label="Sign by typing your full legal name"
            required
            value={businessOffice.scholarSignatureName}
            onChange={(v) => updateSection('businessOffice', { scholarSignatureName: v })}
            placeholder="Avery Johnson"
            help="Typing your name here counts as your signature on the financial statement above."
          />
        </div>
      )}

      {isNotScholar && (
        <div className="reg-subsection">
          <FileUploadField
            label="Approved payment plan or proof of payment"
            required
            helpText="Upload your approved payment plan agreement or a receipt showing proof of payment."
            slot={businessOffice.paymentProofUpload}
            onSelect={(file, error) => updateUploadSlot('businessOffice.paymentProofUpload', file, error)}
            onRemove={() => updateUploadSlot('businessOffice.paymentProofUpload', null, null)}
          />
        </div>
      )}
    </fieldset>
  )
}

export default BusinessOfficeStep
