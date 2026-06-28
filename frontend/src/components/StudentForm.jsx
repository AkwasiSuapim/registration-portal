import { useState } from 'react'

const initialFormData = {
  fullName: '',
  preferredName: '',
  studentId: '',
  dateOfBirth: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  emergencyContactName: '',
  emergencyRelationship: '',
  emergencyContactPhone: '',
  major: '',
  minor: '',
  classification: '',
  registrationTerm: 'Fall 2026',
  academicAdvisor: '',
}

const studentIdentityFields = [
  { name: 'fullName', label: 'Legal full name', type: 'text', placeholder: 'Avery Johnson' },
  { name: 'preferredName', label: 'Preferred name', type: 'text', placeholder: 'Avery' },
  { name: 'studentId', label: 'Student ID', type: 'text', placeholder: 'LC001245' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
]

const contactFields = [
  { name: 'email', label: 'College email', type: 'email', placeholder: 'avery.johnson@lakeview.edu' },
  { name: 'phone', label: 'Mobile phone', type: 'tel', placeholder: '555-123-4567' },
  { name: 'address', label: 'Mailing address', type: 'text', placeholder: '123 Campus Drive' },
  { name: 'city', label: 'City', type: 'text', placeholder: 'Springfield' },
  { name: 'state', label: 'State', type: 'text', placeholder: 'IL' },
  { name: 'zipCode', label: 'ZIP code', type: 'text', placeholder: '62701' },
]

const emergencyFields = [
  { name: 'emergencyContactName', label: 'Emergency contact name', type: 'text', placeholder: 'Jordan Johnson' },
  { name: 'emergencyRelationship', label: 'Relationship', type: 'text', placeholder: 'Parent' },
  { name: 'emergencyContactPhone', label: 'Emergency contact phone', type: 'tel', placeholder: '555-987-6543' },
]

const academicFields = [
  {
    name: 'major',
    label: 'Major',
    type: 'select',
    options: ['Computer Science', 'Business Administration', 'Biology', 'Nursing', 'Education'],
  },
  {
    name: 'minor',
    label: 'Minor',
    type: 'select',
    options: ['None', 'Data Analytics', 'Psychology', 'Spanish', 'Writing'],
  },
  {
    name: 'classification',
    label: 'Classification',
    type: 'select',
    options: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Transfer Student'],
  },
  {
    name: 'registrationTerm',
    label: 'Registration term',
    type: 'select',
    options: ['Fall 2026', 'Spring 2027', 'Summer 2027'],
  },
  { name: 'academicAdvisor', label: 'Academic advisor', type: 'text', placeholder: 'Dr. Morgan Lee' },
]

const courseOptions = [
  {
    id: 'eng-101',
    code: 'ENG 101',
    title: 'College Writing I',
    credits: 3,
    schedule: 'Mon/Wed 9:00 AM',
  },
  {
    id: 'math-151',
    code: 'MATH 151',
    title: 'College Algebra',
    credits: 3,
    schedule: 'Tue/Thu 10:30 AM',
  },
  {
    id: 'cs-130',
    code: 'CS 130',
    title: 'Introduction to Programming',
    credits: 4,
    schedule: 'Mon/Wed 1:00 PM',
  },
  {
    id: 'bio-110',
    code: 'BIO 110',
    title: 'General Biology with Lab',
    credits: 4,
    schedule: 'Tue/Thu 2:00 PM',
  },
  {
    id: 'hist-210',
    code: 'HIST 210',
    title: 'Modern World History',
    credits: 3,
    schedule: 'Fri 9:00 AM',
  },
  {
    id: 'comm-120',
    code: 'COMM 120',
    title: 'Public Speaking',
    credits: 3,
    schedule: 'Wed 4:00 PM',
  },
]

const documentChecklistItems = [
  'Government-issued photo ID',
  'Official high school or college transcript',
  'Immunization record',
  'Proof of residency',
  'Financial clearance or payment plan form',
]

function FormField({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <label className="form-field">
        <span className="form-field__label">{field.label}</span>
        <select
          className="form-field__control"
          name={field.name}
          value={value}
          onChange={onChange}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label className="form-field">
      <span className="form-field__label">{field.label}</span>
      <input
        className="form-field__control"
        type={field.type}
        name={field.name}
        value={value}
        placeholder={field.placeholder}
        onChange={onChange}
      />
    </label>
  )
}

function StudentForm() {
  const [formData, setFormData] = useState(initialFormData)
  const [selectedCourseIds, setSelectedCourseIds] = useState([])
  const [completedDocumentIds, setCompletedDocumentIds] = useState([])
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('')

  const selectedCourses = courseOptions.filter((course) =>
    selectedCourseIds.includes(course.id)
  )

  const totalCreditHours = selectedCourses.reduce(
    (total, course) => total + course.credits,
    0
  )

  const handleInputChange = (event) => {
    const { name, value } = event.target

    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleCourseToggle = (courseId) => {
    if (selectedCourseIds.includes(courseId)) {
      setSelectedCourseIds(selectedCourseIds.filter((id) => id !== courseId))
      return
    }

    setSelectedCourseIds([...selectedCourseIds, courseId])
  }

  const handleDocumentToggle = (documentName) => {
    if (completedDocumentIds.includes(documentName)) {
      setCompletedDocumentIds(completedDocumentIds.filter((id) => id !== documentName))
      return
    }

    setCompletedDocumentIds([...completedDocumentIds, documentName])
  }

  const handleSaveDraft = () => {
    setStatusType('success')
    setStatusMessage('Draft saved successfully.')
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!isConfirmed) {
      setStatusType('error')
      setStatusMessage('Please confirm that your information is accurate before submitting.')
      return
    }

    const registrationData = {
      ...formData,
      selectedCourses,
      completedDocuments: completedDocumentIds,
      totalCreditHours,
      status: 'Pending',
    }

    console.log('Submitted registration:', registrationData)
    setStatusType('success')
    setStatusMessage(
      'Registration submitted successfully. Your application is ready for registrar review.'
    )
  }

  return (
    <form className="student-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <div className="form-section__header">
          <p className="form-section__eyebrow">Step 1</p>
          <h2 className="form-section__title">Student Identity</h2>
        </div>
        <div className="form-grid">
          {studentIdentityFields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={handleInputChange}
            />
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <p className="form-section__eyebrow">Step 2</p>
          <h2 className="form-section__title">Contact Information</h2>
        </div>
        <div className="form-grid form-grid--contact">
          {contactFields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={handleInputChange}
            />
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <p className="form-section__eyebrow">Step 3</p>
          <h2 className="form-section__title">Emergency Contact</h2>
        </div>
        <div className="form-grid">
          {emergencyFields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={handleInputChange}
            />
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <p className="form-section__eyebrow">Step 4</p>
          <h2 className="form-section__title">Academic Information</h2>
        </div>
        <div className="form-grid">
          {academicFields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={handleInputChange}
            />
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header form-section__header--split">
          <div>
            <p className="form-section__eyebrow">Step 5</p>
            <h2 className="form-section__title">Course Selection Preview</h2>
          </div>
          <div className="credit-summary">
            <span className="credit-summary__number">{totalCreditHours}</span>
            <span className="credit-summary__label">selected credits</span>
          </div>
        </div>

        <div className="course-list">
          {courseOptions.map((course) => (
            <label key={course.id} className="course-option">
              <input
                type="checkbox"
                checked={selectedCourseIds.includes(course.id)}
                onChange={() => handleCourseToggle(course.id)}
              />
              <span className="course-option__body">
                <span className="course-option__main">
                  <strong>{course.code}</strong>
                  <span>{course.title}</span>
                </span>
                <span className="course-option__details">
                  {course.credits} credits - {course.schedule}
                </span>
              </span>
            </label>
          ))}
        </div>

        {totalCreditHours < 12 && (
          <p className="form-warning">
            Warning: full-time registration usually requires at least 12 credit hours.
          </p>
        )}

        {totalCreditHours > 18 && (
          <p className="form-warning">
            Warning: more than 18 credit hours may require advisor approval.
          </p>
        )}
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <p className="form-section__eyebrow">Step 6</p>
          <h2 className="form-section__title">Document Checklist</h2>
        </div>
        <div className="checklist">
          {documentChecklistItems.map((documentName) => (
            <label key={documentName} className="checklist-item">
              <input
                type="checkbox"
                checked={completedDocumentIds.includes(documentName)}
                onChange={() => handleDocumentToggle(documentName)}
              />
              <span>{documentName}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <p className="form-section__eyebrow">Step 7</p>
          <h2 className="form-section__title">Review and Submit</h2>
        </div>

        <div className="review-panel">
          <div>
            <span className="review-panel__label">Student</span>
            <strong>{formData.fullName || 'Not entered yet'}</strong>
          </div>
          <div>
            <span className="review-panel__label">Program</span>
            <strong>{formData.major || 'Not selected yet'}</strong>
          </div>
          <div>
            <span className="review-panel__label">Courses</span>
            <strong>{selectedCourses.length} selected</strong>
          </div>
          <div>
            <span className="review-panel__label">Documents</span>
            <strong>{completedDocumentIds.length} of {documentChecklistItems.length}</strong>
          </div>
        </div>

        <label className="confirmation-check">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(event) => setIsConfirmed(event.target.checked)}
          />
          <span>
            I confirm that the information in this registration is accurate and ready
            for registrar review.
          </span>
        </label>

        {statusMessage && (
          <p className={`form-status form-status--${statusType}`}>
            {statusMessage}
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={handleSaveDraft}
          >
            Save Draft
          </button>
          <button type="submit" className="btn btn--primary">
            Submit Registration
          </button>
        </div>
      </section>
    </form>
  )
}

export default StudentForm
