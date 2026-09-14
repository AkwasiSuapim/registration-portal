import { TextField } from '../fields'
import FileUploadField from '../FileUploadField'

// Step 1 — Welcome Desk: student identity, contact information, photo ID.
function WelcomeDeskStep({ state, updateSection, updateUploadSlot }) {
  const { identity, contact } = state

  return (
    <>
      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Student identity</legend>
        <div className="reg-grid">
          <TextField label="Legal full name" required value={identity.fullName}
            onChange={(v) => updateSection('identity', { fullName: v })} placeholder="Avery Johnson" />
          <TextField label="Preferred name" value={identity.preferredName}
            onChange={(v) => updateSection('identity', { preferredName: v })} placeholder="Avery" />
          <TextField label="Student ID" required value={identity.studentId}
            onChange={(v) => updateSection('identity', { studentId: v })} placeholder="100123456" />
          <TextField label="Date of birth" required type="date" value={identity.dateOfBirth}
            onChange={(v) => updateSection('identity', { dateOfBirth: v })} />
        </div>
      </fieldset>

      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Contact information</legend>
        <div className="reg-grid">
          <TextField label="College email" required type="email" value={contact.email}
            onChange={(v) => updateSection('contact', { email: v })} placeholder="avery.johnson@student.livingstone.edu" />
          <TextField label="Mobile phone" required type="tel" value={contact.phone}
            onChange={(v) => updateSection('contact', { phone: v })} placeholder="555-123-4567" />
          <TextField label="Mailing address" required value={contact.address}
            onChange={(v) => updateSection('contact', { address: v })} placeholder="123 Campus Drive" />
          <TextField label="City" required value={contact.city}
            onChange={(v) => updateSection('contact', { city: v })} placeholder="Salisbury" />
          <TextField label="State" required value={contact.state}
            onChange={(v) => updateSection('contact', { state: v })} placeholder="NC" />
          <TextField label="ZIP code" required value={contact.zipCode}
            onChange={(v) => updateSection('contact', { zipCode: v })} placeholder="28144" />
        </div>
      </fieldset>

      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Photo ID</legend>
        <FileUploadField
          label="Photo ID"
          required
          helpText="A government-issued or current student photo ID (PDF, PNG, JPEG, or DOCX, up to 10 MB)."
          slot={state.photoIdUpload}
          onSelect={(file, error) => updateUploadSlot('photoIdUpload', file, error)}
          onRemove={() => updateUploadSlot('photoIdUpload', null, null)}
        />
      </fieldset>
    </>
  )
}

export default WelcomeDeskStep
