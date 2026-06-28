import StudentForm from '../components/StudentForm'

function RegisterStudent({ onNavigate }) {
  return (
    <div className="registration-page">
      <header className="registration-page__header">
        <button
          type="button"
          className="registration-page__back"
          onClick={() => onNavigate('home')}
        >
          Back to Home
        </button>
        <div>
          <p className="registration-page__eyebrow">Registrar intake form</p>
          <h1 className="registration-page__title">Student Registration</h1>
          <p className="registration-page__desc">
            Complete your student details, preview a course load, and prepare your
            record for registrar review.
          </p>
        </div>
      </header>

      <StudentForm />
    </div>
  )
}

export default RegisterStudent
