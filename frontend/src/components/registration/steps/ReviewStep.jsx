import { COURSE_OPTIONS } from '../wizardConfig'

function uploadSummary(slot, emptyText = 'Not uploaded') {
  if (!slot || !slot.file) return emptyText
  return slot.status === 'error' ? `${slot.name} (needs attention)` : slot.name
}

// Step 7 — Review and Submit: groups every answer and file by the
// office that owns it, with an Edit link back to the right step, plus
// the required confirmation checkbox. Submitting is handled by the
// wizard's shared footer button (see RegistrationWizard.jsx) so this
// component only renders the summary and the checkbox.
function ReviewStep({ state, onEditStep, onToggleConfirmed }) {
  const selectedCourses = COURSE_OPTIONS.filter((c) => state.selectedCourseIds.includes(c.id))
  const totalCreditHours = selectedCourses.reduce((total, c) => total + c.credits, 0)

  const groups = [
    {
      title: 'Welcome Desk', stepIndex: 0,
      rows: [
        ['Legal name', state.identity.fullName || '—'],
        ['Student ID', state.identity.studentId || '—'],
        ['Date of birth', state.identity.dateOfBirth || '—'],
        ['Contact', [state.contact.email, state.contact.phone].filter(Boolean).join(' · ') || '—'],
        ['Mailing address', [state.contact.address, state.contact.city, state.contact.state, state.contact.zipCode].filter(Boolean).join(', ') || '—'],
        ['Photo ID', uploadSummary(state.photoIdUpload)],
      ],
    },
    {
      title: 'Health Services', stepIndex: 1,
      rows: [
        ['Emergency contact', [state.emergency.name, state.emergency.relationship, state.emergency.phone].filter(Boolean).join(' · ') || '—'],
        ['Health information', state.health.conditions ? 'On file' : 'None reported'],
        ['Immunization form', uploadSummary(state.immunizationUpload)],
        ['Health / hospital card', uploadSummary(state.healthCardUpload)],
      ],
    },
    {
      title: 'Success Center', stepIndex: 2,
      rows: [
        ['Major', state.academic.major || '—'],
        ['Classification', state.academic.classification || '—'],
        ['Term', state.academic.registrationTerm || '—'],
        ['Courses', selectedCourses.length ? `${selectedCourses.length} selected (${totalCreditHours} credits)` : 'None selected'],
        ['Transcript', uploadSummary(state.transcriptUpload, 'Not uploaded (optional)')],
      ],
    },
    {
      title: 'Financial Aid', stepIndex: 3,
      rows: [['Status', 'Reviewed on the Financial Aid step — no action needed from you here.']],
    },
    {
      title: 'Business Office and Cashier', stepIndex: 4,
      rows: state.businessOffice.isPresidentialScholar === 'yes'
        ? [
            ['Presidential Scholar', 'Yes'],
            ['Signature', state.businessOffice.scholarSignatureName || '—'],
          ]
        : [
            ['Presidential Scholar', state.businessOffice.isPresidentialScholar === 'no' ? 'No' : '—'],
            ['Payment plan / proof of payment', uploadSummary(state.businessOffice.paymentProofUpload)],
          ],
    },
    {
      title: 'Residence Life', stepIndex: 5,
      rows: state.residenceLife.housingStatus === 'on-campus'
        ? [
            ['Housing status', 'On-campus resident'],
            ['Residence hall', state.residenceLife.hall || '—'],
            ['Room number', state.residenceLife.roomNumber || 'Not yet assigned'],
            ['Housing-fee receipt', uploadSummary(state.residenceLife.feeReceiptUpload)],
          ]
        : [['Housing status', state.residenceLife.housingStatus === 'commuter' ? 'Commuter' : '—']],
    },
  ]

  return (
    <>
      {groups.map((group) => (
        <section key={group.title} className="reg-review-group">
          <div className="reg-review-group__head">
            <h3 className="reg-review-group__title">{group.title}</h3>
            <button type="button" className="reg-review-group__edit" onClick={() => onEditStep(group.stepIndex)}>
              Edit
            </button>
          </div>
          <dl className="reg-review-group__list">
            {group.rows.map(([label, value]) => (
              <div key={label} className="reg-review-group__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <label className="reg-confirm">
        <input type="checkbox" checked={state.confirmed} onChange={(e) => onToggleConfirmed(e.target.checked)} />
        <span>
          I confirm that the information and documents in this registration are accurate and ready
          for review by each office.
        </span>
      </label>
    </>
  )
}

export default ReviewStep
