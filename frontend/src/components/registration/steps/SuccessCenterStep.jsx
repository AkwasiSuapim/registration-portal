import { TextField, SelectField } from '../fields'
import FileUploadField from '../FileUploadField'
import {
  MAJOR_OPTIONS, MINOR_OPTIONS, CLASSIFICATION_OPTIONS, TERM_OPTIONS,
  COURSE_OPTIONS, MIN_CREDIT_HOURS,
} from '../wizardConfig'

// Step 3 — Success Center: major, classification, academic information,
// courses, and an optional transcript that never blocks submission.
function SuccessCenterStep({ state, updateSection, updateSelectedCourses, updateUploadSlot }) {
  const { academic, selectedCourseIds } = state
  const totalCreditHours = COURSE_OPTIONS
    .filter((course) => selectedCourseIds.includes(course.id))
    .reduce((total, course) => total + course.credits, 0)

  const toggleCourse = (courseId) => {
    if (selectedCourseIds.includes(courseId)) {
      updateSelectedCourses(selectedCourseIds.filter((id) => id !== courseId))
    } else {
      updateSelectedCourses([...selectedCourseIds, courseId])
    }
  }

  return (
    <>
      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Academic information</legend>
        <div className="reg-grid">
          <SelectField label="Major" required value={academic.major}
            onChange={(v) => updateSection('academic', { major: v })} options={MAJOR_OPTIONS} />
          <SelectField label="Minor" value={academic.minor}
            onChange={(v) => updateSection('academic', { minor: v })} options={MINOR_OPTIONS} />
          <SelectField label="Classification" required value={academic.classification}
            onChange={(v) => updateSection('academic', { classification: v })} options={CLASSIFICATION_OPTIONS} />
          <SelectField label="Registration term" required value={academic.registrationTerm}
            onChange={(v) => updateSection('academic', { registrationTerm: v })} options={TERM_OPTIONS} />
          <TextField label="Academic advisor" value={academic.academicAdvisor}
            onChange={(v) => updateSection('academic', { academicAdvisor: v })} placeholder="Optional" />
        </div>
      </fieldset>

      <fieldset className="reg-fieldset">
        <div className="reg-fieldset__legend-row">
          <legend className="reg-fieldset__legend">Courses</legend>
          <div className="reg-credit-summary">
            <span className="reg-credit-summary__value">{totalCreditHours}</span>
            <span className="reg-credit-summary__label">selected credits</span>
          </div>
        </div>
        <div className="reg-course-list">
          {COURSE_OPTIONS.map((course) => (
            <label key={course.id} className="reg-course-option">
              <input
                type="checkbox"
                checked={selectedCourseIds.includes(course.id)}
                onChange={() => toggleCourse(course.id)}
              />
              <span className="reg-course-option__body">
                <span className="reg-course-option__main">
                  <strong>{course.code}</strong>
                  <span>{course.title}</span>
                </span>
                <span className="reg-course-option__details">{course.credits} credits — {course.schedule}</span>
              </span>
            </label>
          ))}
        </div>
        {totalCreditHours > 0 && totalCreditHours < MIN_CREDIT_HOURS && (
          <p className="reg-warning">You need at least {MIN_CREDIT_HOURS} credit hours to continue.</p>
        )}
      </fieldset>

      <fieldset className="reg-fieldset">
        <legend className="reg-fieldset__legend">Transcript</legend>
        <FileUploadField
          label="Transcript (optional)"
          helpText="Optional for every student. Uploading it now will not block your submission."
          slot={state.transcriptUpload}
          onSelect={(file, error) => updateUploadSlot('transcriptUpload', file, error)}
          onRemove={() => updateUploadSlot('transcriptUpload', null, null)}
        />
      </fieldset>
    </>
  )
}

export default SuccessCenterStep
