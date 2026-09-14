import { TextField, TextAreaField, SelectField } from '../fields'
import FileUploadField from '../FileUploadField'
import { RELATIONSHIP_OPTIONS } from '../wizardConfig'

// Step 2 — Health Services: health information, emergency contact,
// immunization form, and health/hospital card.
//
// Health information has no backend column today — it is kept in this
// session only (see the "missing API support" note in the wizard's
// final summary) and is never sent to the server.
function HealthServicesStep({ state, updateSection, updateUploadSlot }) {
  const { health, emergency } = state

  return (
    <>
      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Health information</legend>
        <p className="reg-fieldset__note">
          Shared with Health Services only. Leave a field blank if it does not apply to you.
        </p>
        <div className="reg-grid">
          <TextAreaField label="Known conditions or allergies" value={health.conditions}
            onChange={(v) => updateSection('health', { conditions: v })} placeholder="e.g. Asthma, peanut allergy — or None" />
          <TextAreaField label="Current medications" value={health.medications}
            onChange={(v) => updateSection('health', { medications: v })} placeholder="Optional" />
          <TextField label="Primary physician" value={health.physicianName}
            onChange={(v) => updateSection('health', { physicianName: v })} placeholder="Optional" />
          <TextField label="Physician phone" type="tel" value={health.physicianPhone}
            onChange={(v) => updateSection('health', { physicianPhone: v })} placeholder="Optional" />
          <TextField label="Insurance provider" value={health.insuranceProvider}
            onChange={(v) => updateSection('health', { insuranceProvider: v })} placeholder="Optional" />
          <TextField label="Insurance policy number" value={health.insurancePolicyNumber}
            onChange={(v) => updateSection('health', { insurancePolicyNumber: v })} placeholder="Optional" />
        </div>
      </fieldset>

      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Emergency contact</legend>
        <div className="reg-grid">
          <TextField label="Emergency contact name" required value={emergency.name}
            onChange={(v) => updateSection('emergency', { name: v })} placeholder="Jordan Johnson" />
          <SelectField label="Relationship" required value={emergency.relationship}
            onChange={(v) => updateSection('emergency', { relationship: v })} options={RELATIONSHIP_OPTIONS} />
          <TextField label="Emergency contact phone" required type="tel" value={emergency.phone}
            onChange={(v) => updateSection('emergency', { phone: v })} placeholder="555-987-6543" />
        </div>
      </fieldset>

      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Health documents</legend>
        <div className="reg-upload-grid">
          <FileUploadField
            label="Immunization form"
            required
            helpText="Official immunization history from your healthcare provider."
            slot={state.immunizationUpload}
            onSelect={(file, error) => updateUploadSlot('immunizationUpload', file, error)}
            onRemove={() => updateUploadSlot('immunizationUpload', null, null)}
          />
          <FileUploadField
            label="Health or hospital card"
            required
            helpText="A copy of your health insurance or hospital card."
            slot={state.healthCardUpload}
            onSelect={(file, error) => updateUploadSlot('healthCardUpload', file, error)}
            onRemove={() => updateUploadSlot('healthCardUpload', null, null)}
          />
        </div>
      </fieldset>
    </>
  )
}

export default HealthServicesStep
