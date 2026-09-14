import { TextField, SelectField } from '../fields'
import FileUploadField from '../FileUploadField'
import { HOUSING_STATUS_OPTIONS, RESIDENCE_HALL_OPTIONS } from '../wizardConfig'

// Step 6 — Residence Life: housing status, hall, room number (if
// assigned), and the housing-fee receipt. Residence hall and room
// number have no backend column today (Application only stores a
// housing_required boolean) — kept in this session only, reported as
// missing API support at the end of the feature summary.
function ResidenceLifeStep({ state, updateSection, updateUploadSlot }) {
  const { residenceLife } = state
  const isOnCampus = residenceLife.housingStatus === 'on-campus'

  return (
    <fieldset className="reg-fieldset">
      <legend className="reg-fieldset__legend">Housing</legend>

      <div className="reg-radio-group" role="radiogroup" aria-label="Housing status">
        {HOUSING_STATUS_OPTIONS.map((option) => (
          <label key={option.value} className="reg-radio">
            <input
              type="radio"
              name="housing-status"
              checked={residenceLife.housingStatus === option.value}
              onChange={() => updateSection('residenceLife', { housingStatus: option.value })}
            />
            {option.label}
          </label>
        ))}
      </div>

      {isOnCampus && (
        <div className="reg-subsection">
          <div className="reg-grid">
            <SelectField
              label="Residence hall" required
              value={residenceLife.hall}
              onChange={(v) => updateSection('residenceLife', { hall: v })}
              options={RESIDENCE_HALL_OPTIONS}
            />
            <TextField
              label="Room number (if assigned)"
              value={residenceLife.roomNumber}
              onChange={(v) => updateSection('residenceLife', { roomNumber: v })}
              placeholder="Assigned by Residence Life"
            />
          </div>

          <FileUploadField
            label="Housing-fee receipt"
            required
            helpText="A receipt showing your housing fee has been paid or arranged."
            slot={residenceLife.feeReceiptUpload}
            onSelect={(file, error) => updateUploadSlot('residenceLife.feeReceiptUpload', file, error)}
            onRemove={() => updateUploadSlot('residenceLife.feeReceiptUpload', null, null)}
          />
        </div>
      )}
    </fieldset>
  )
}

export default ResidenceLifeStep
