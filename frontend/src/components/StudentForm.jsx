import { useState } from 'react'
import { createApplication } from '../services/api'

/* -------------------------------------------------------
   Initial form state
------------------------------------------------------- */
const initialFormData = {
  fullName:              '',
  preferredName:         '',
  studentId:             '',
  dateOfBirth:           '',
  email:                 '',
  phone:                 '',
  address:               '',
  city:                  '',
  state:                 '',
  zipCode:               '',
  emergencyContactName:  '',
  emergencyRelationship: '',
  emergencyContactPhone: '',
  major:                 '',
  minor:                 '',
  classification:        '',
  registrationTerm:      'Fall 2026',
  academicAdvisor:       '',
  housingRequired:       '',
}

/* -------------------------------------------------------
   Field definitions for each form section
------------------------------------------------------- */
const studentIdentityFields = [
  { name: 'fullName',      label: 'Legal full name', type: 'text', placeholder: 'Avery Johnson' },
  { name: 'preferredName', label: 'Preferred name',  type: 'text', placeholder: 'Avery'         },
  { name: 'studentId',     label: 'Student ID',       type: 'text', placeholder: 'LC001245'      },
  { name: 'dateOfBirth',   label: 'Date of birth',    type: 'date'                               },
]

const contactFields = [
  { name: 'email',   label: 'College email',   type: 'email', placeholder: 'avery.johnson@lakeview.edu' },
  { name: 'phone',   label: 'Mobile phone',    type: 'tel',   placeholder: '555-123-4567'               },
  { name: 'address', label: 'Mailing address', type: 'text',  placeholder: '123 Campus Drive'           },
  { name: 'city',    label: 'City',            type: 'text',  placeholder: 'Springfield'                },
  { name: 'state',   label: 'State',           type: 'text',  placeholder: 'IL'                         },
  { name: 'zipCode', label: 'ZIP code',        type: 'text',  placeholder: '62701'                      },
]

const emergencyFields = [
  { name: 'emergencyContactName',  label: 'Emergency contact name',  type: 'text', placeholder: 'Jordan Johnson' },
  { name: 'emergencyRelationship', label: 'Relationship',            type: 'text', placeholder: 'Parent'         },
  { name: 'emergencyContactPhone', label: 'Emergency contact phone', type: 'tel',  placeholder: '555-987-6543'   },
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
  {
    name: 'housingRequired',
    label: 'On-campus housing required?',
    type: 'select',
    options: ['Yes', 'No'],
  },
]

const courseOptions = [
  { id: 'eng-101',  code: 'ENG 101',  title: 'College Writing I',          credits: 3, schedule: 'Mon/Wed 9:00 AM'  },
  { id: 'math-151', code: 'MATH 151', title: 'College Algebra',             credits: 3, schedule: 'Tue/Thu 10:30 AM' },
  { id: 'cs-130',   code: 'CS 130',   title: 'Introduction to Programming', credits: 4, schedule: 'Mon/Wed 1:00 PM'  },
  { id: 'bio-110',  code: 'BIO 110',  title: 'General Biology with Lab',    credits: 4, schedule: 'Tue/Thu 2:00 PM'  },
  { id: 'hist-210', code: 'HIST 210', title: 'Modern World History',        credits: 3, schedule: 'Fri 9:00 AM'      },
  { id: 'comm-120', code: 'COMM 120', title: 'Public Speaking',             credits: 3, schedule: 'Wed 4:00 PM'      },
]

const documentItems = [
  {
    id:          'admission-letter',
    name:        'Admission Letter',
    description: 'Your official letter of admission from Livingstone College.',
    required:    true,
  },
  {
    id:          'hs-transcript',
    name:        'Official High School Transcript',
    description: 'Sealed official transcript issued directly from your high school.',
    required:    true,
  },
  {
    id:          'college-transcript',
    name:        'Previous College Transcript',
    description: 'Required if you are a transfer student from another institution.',
    required:    false,
  },
  {
    id:          'test-scores',
    name:        'ACT/SAT Test Scores',
    description: 'Submit if available. Not required for all programs.',
    required:    false,
  },
  {
    id:          'photo-id',
    name:        'Photo ID',
    description: "Government-issued photo ID such as a driver's license or passport.",
    required:    true,
  },
  {
    id:          'immunization',
    name:        'Immunization Record',
    description: 'Official immunization history from your healthcare provider.',
    required:    true,
  },
  {
    id:          'financial-clearance',
    name:        'Financial Clearance Document',
    description: 'Proof of payment, financial aid award, or an approved payment plan.',
    required:    true,
  },
  {
    id:          'housing-confirmation',
    name:        'Housing Confirmation',
    description: 'Required if you are registered to live on campus.',
    required:    false,
  },
]

/* -------------------------------------------------------
   Validation — field names mapped to readable labels.
   Only fields that exist in the current form are listed.
   Optional fields (preferredName, minor, academicAdvisor)
   are intentionally excluded.
------------------------------------------------------- */
const REQUIRED_FIELD_LABELS = {
  studentId:             'Student ID',
  fullName:              'Legal full name',
  dateOfBirth:           'Date of birth',
  classification:        'Classification',
  email:                 'College email',
  phone:                 'Mobile phone',
  address:               'Mailing address',
  city:                  'City',
  state:                 'State',
  zipCode:               'ZIP code',
  emergencyContactName:  'Emergency contact name',
  emergencyRelationship: 'Relationship',
  emergencyContactPhone: 'Emergency contact phone',
  major:                 'Major',
  housingRequired:       'On-campus housing required?',
}

// Document IDs that must be uploaded regardless of student type
const ALWAYS_REQUIRED_DOC_IDS = [
  'admission-letter',
  'hs-transcript',
  'photo-id',
  'immunization',
  'financial-clearance',
]

// Returns the full list of required document IDs for this student.
// Transfer students have one additional required document.
function getRequiredDocuments(classification) {
  const required = [...ALWAYS_REQUIRED_DOC_IDS]
  if (classification === 'Transfer Student') {
    required.push('college-transcript')
  }
  return required
}

// Returns an array of error strings for any required field that is empty.
function validateRequiredFields(formData) {
  const errors = []
  for (const [fieldName, label] of Object.entries(REQUIRED_FIELD_LABELS)) {
    const value = formData[fieldName]
    if (!value || value.trim() === '') {
      errors.push(`${label} is required.`)
    }
  }
  return errors
}

// Returns an array of error strings for any required document that has not been uploaded.
function validateRequiredDocuments(documentUploads, classification) {
  const errors = []
  const requiredDocIds = getRequiredDocuments(classification)

  for (const docId of requiredDocIds) {
    if (!documentUploads[docId]) {
      if (docId === 'college-transcript') {
        errors.push(
          'Please upload Previous College Transcript because you selected Transfer Student.'
        )
      } else {
        const doc = documentItems.find((d) => d.id === docId)
        errors.push(`Please upload ${doc.name}.`)
      }
    }
  }
  return errors
}

// Returns an array of error strings for insufficient course credit hours.
// Livingstone College requires at least 15 credit hours for full registration.
function validateCourseSelection(selectedCourses, totalCreditHours) {
  if (selectedCourses.length === 0) {
    return ['Please select at least one course.']
  }
  if (totalCreditHours < 15) {
    return [
      'You must select at least 15 credit hours before submitting your registration.',
    ]
  }
  return []
}

// Runs all validation checks and returns a single array of all errors.
// An empty array means the form is valid and ready to submit.
function validateForm(formData, documentUploads, selectedCourses, totalCreditHours, isConfirmed) {
  const errors = [
    ...validateRequiredFields(formData),
    ...validateRequiredDocuments(documentUploads, formData.classification),
    ...validateCourseSelection(selectedCourses, totalCreditHours),
  ]
  if (!isConfirmed) {
    errors.push('Please check the confirmation box to confirm your information is accurate.')
  }
  return errors
}

// Derives the backend "academic_year" (e.g. "2026-2027") from a
// registration term like "Fall 2026" or "Spring 2027". Fall starts an
// academic year; Spring/Summer fall inside the year that started the
// previous Fall.
function deriveAcademicYear(registrationTerm) {
  const match = registrationTerm.match(/(\d{4})/)
  if (!match) return ''
  const year = Number(match[1])
  return registrationTerm.startsWith('Fall') ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

// Maps the form's state into the exact payload POST /applications expects.
function buildApplicationPayload(formData, selectedCourses) {
  return {
    term_code:         formData.registrationTerm,
    academic_year:     deriveAcademicYear(formData.registrationTerm),
    major:             formData.major,
    classification:    formData.classification,
    housing_required:  formData.housingRequired === 'Yes',
    courses: selectedCourses.map((course) => ({
      course_code:  course.code,
      course_title: course.title,
      section:      null,
      credit_hours: course.credits,
    })),
  }
}

/* -------------------------------------------------------
   FormField — reusable input/select renderer
------------------------------------------------------- */
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

/* -------------------------------------------------------
   DocumentUploadItem — one row per required/optional doc
------------------------------------------------------- */
function DocumentUploadItem({ doc, uploadedFile, onUpload, onRemove }) {
  const isUploaded = Boolean(uploadedFile)

  return (
    <div className={`document-item${isUploaded ? ' document-item--uploaded' : ''}`}>
      <div className="document-item__info">
        <div className="document-item__header">
          <span className="document-item__name">{doc.name}</span>
          <span className={`document-item__badge document-item__badge--${doc.required ? 'required' : 'optional'}`}>
            {doc.required ? 'Required' : 'Optional'}
          </span>
        </div>
        <p className="document-item__desc">{doc.description}</p>
        {isUploaded && (
          <span className="document-item__filename">{uploadedFile.name}</span>
        )}
      </div>

      <div className="document-item__actions">
        <span className={`document-item__status document-item__status--${isUploaded ? 'uploaded' : 'empty'}`}>
          {isUploaded ? 'Uploaded' : 'Not Uploaded'}
        </span>

        {isUploaded ? (
          <button
            type="button"
            className="doc-btn doc-btn--remove"
            onClick={() => onRemove(doc.id)}
          >
            Remove
          </button>
        ) : (
          <label className="doc-btn doc-btn--upload">
            Choose File
            <input
              type="file"
              className="document-item__file-input"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(event) => onUpload(doc.id, event)}
            />
          </label>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------
   StudentForm — main form component
------------------------------------------------------- */
function StudentForm() {
  const [formData, setFormData]                   = useState(initialFormData)
  const [selectedCourseIds, setSelectedCourseIds] = useState([])
  const [documentUploads, setDocumentUploads]     = useState({})
  const [isConfirmed, setIsConfirmed]             = useState(false)
  const [validationErrors, setValidationErrors]   = useState([])
  const [statusMessage, setStatusMessage]         = useState('')
  const [statusType, setStatusType]               = useState('')
  const [submitting, setSubmitting]               = useState(false)

  const selectedCourses = courseOptions.filter((course) =>
    selectedCourseIds.includes(course.id)
  )

  const totalCreditHours = selectedCourses.reduce(
    (total, course) => total + course.credits,
    0
  )

  const uploadedDocumentCount = Object.keys(documentUploads).length

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData({ ...formData, [name]: value })
  }

  const handleCourseToggle = (courseId) => {
    if (selectedCourseIds.includes(courseId)) {
      setSelectedCourseIds(selectedCourseIds.filter((id) => id !== courseId))
      return
    }
    setSelectedCourseIds([...selectedCourseIds, courseId])
  }

  const handleDocumentUpload = (documentId, event) => {
    const file = event.target.files[0]
    if (!file) return
    setDocumentUploads({ ...documentUploads, [documentId]: file })
  }

  const handleRemoveDocument = (documentId) => {
    const updated = { ...documentUploads }
    delete updated[documentId]
    setDocumentUploads(updated)
  }

  const handleSaveDraft = () => {
    setValidationErrors([])
    setStatusType('success')
    setStatusMessage('Draft saved successfully.')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    // Run all validation checks before doing anything else
    const errors = validateForm(
      formData,
      documentUploads,
      selectedCourses,
      totalCreditHours,
      isConfirmed
    )

    // If there are any errors, show them and stop — do not call the backend
    if (errors.length > 0) {
      setValidationErrors(errors)
      setStatusMessage('')
      setStatusType('')
      return
    }

    // All checks passed — clear errors and submit to the backend.
    // The backend has the final say (duplicate term, credit minimum, etc.)
    setValidationErrors([])
    setStatusMessage('')
    setStatusType('')
    setSubmitting(true)

    try {
      const application = await createApplication(buildApplicationPayload(formData, selectedCourses))
      setStatusType('success')
      setStatusMessage(
        `Registration submitted successfully. Application ${application.application_number} ` +
        `is now ${application.overall_status.replace(/_/g, ' ')} — next step: ` +
        `${(application.current_step || 'complete').replace(/_/g, ' ')}.`
      )
    } catch (err) {
      setStatusType('error')
      setStatusMessage(err.message || 'Something went wrong while submitting your registration.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="student-form" onSubmit={handleSubmit}>

      {/* Step 1: Student Identity */}
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

      {/* Step 2: Contact Information */}
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

      {/* Step 3: Emergency Contact */}
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

      {/* Step 4: Academic Information */}
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

      {/* Step 5: Course Selection */}
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
                  {course.credits} credits — {course.schedule}
                </span>
              </span>
            </label>
          ))}
        </div>

        {totalCreditHours > 0 && totalCreditHours < 15 && (
          <p className="form-warning">
            Warning: you need at least 15 credit hours to submit your registration.
          </p>
        )}

        {totalCreditHours > 18 && (
          <p className="form-warning">
            Warning: more than 18 credit hours may require advisor approval.
          </p>
        )}
      </section>

      {/* Step 6: Document Upload */}
      <section className="form-section">
        <div className="form-section__header">
          <p className="form-section__eyebrow">Step 6</p>
          <h2 className="form-section__title">Document Upload</h2>
        </div>
        <div className="document-list">
          {documentItems.map((doc) => (
            <DocumentUploadItem
              key={doc.id}
              doc={doc}
              uploadedFile={documentUploads[doc.id] || null}
              onUpload={handleDocumentUpload}
              onRemove={handleRemoveDocument}
            />
          ))}
        </div>
      </section>

      {/* Step 7: Review and Submit */}
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
            <strong>{selectedCourses.length} selected ({totalCreditHours} credits)</strong>
          </div>
          <div>
            <span className="review-panel__label">Documents</span>
            <strong>{uploadedDocumentCount} of {documentItems.length} uploaded</strong>
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

        {/* Validation error summary — shown only when Submit was clicked with issues */}
        {validationErrors.length > 0 && (
          <div className="validation-summary">
            <p className="validation-summary__heading">
              Please fix the following issues before submitting:
            </p>
            <ul className="validation-summary__list">
              {validationErrors.map((error, index) => (
                <li key={index} className="validation-summary__item">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

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
            disabled={submitting}
          >
            Save Draft
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Registration'}
          </button>
        </div>
      </section>

    </form>
  )
}

export default StudentForm
