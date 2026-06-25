const formSections = [
  'Personal Info',
  'Contact Info',
  'Academic Info',
  'Documents',
]

function RegisterStudent({ onNavigate }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page__header">
        <h1 className="placeholder-page__title">Student Registration</h1>
        <p className="placeholder-page__desc">
          The full registration form is coming next. Students will be able to
          complete their registration entirely online — no in-person queuing required.
        </p>
      </div>

      <div className="placeholder-card">
        <h2 className="placeholder-card__heading">Form sections coming next:</h2>
        <ul className="placeholder-card__list">
          {formSections.map((section) => (
            <li key={section} className="placeholder-card__item">
              {section}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="btn btn--outline"
        onClick={() => onNavigate('home')}
      >
        ← Back to Home
      </button>
    </div>
  )
}

export default RegisterStudent
