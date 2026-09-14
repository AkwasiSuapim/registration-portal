/* -------------------------------------------------------
   StepIndicator — accessible, USWDS-inspired step indicator.

   Not a navigation control (steps are not clickable) — Back / Save &
   Continue on each step are the only way to move, per the linear-form
   requirement. This component only communicates progress: short labels,
   completed/current/upcoming states, checkmarks, and "Step X of N" for
   screen-reader users.
------------------------------------------------------- */
function StepIndicator({ steps, currentIndex }) {
  const current = steps[currentIndex]

  return (
    <nav aria-label="Registration progress" className="reg-steps">
      <p className="reg-steps__status">
        <span className="reg-steps__status-count">Step {currentIndex + 1} of {steps.length}</span>
        <span className="reg-steps__status-label">{current.label}</span>
      </p>
      <ol className="reg-steps__list">
        {steps.map((step, index) => {
          const state = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming'
          return (
            <li
              key={step.key}
              className={`reg-steps__item reg-steps__item--${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="reg-steps__marker" aria-hidden="true">
                {state === 'complete' ? '✓' : index + 1}
              </span>
              <span className="reg-steps__label">
                {step.label}
                <span className="reg-visually-hidden">
                  {state === 'complete' ? ' — completed' : state === 'current' ? ' — current step' : ' — upcoming'}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default StepIndicator
