const STAT_ICON_PATHS = {
  people:
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  document:
    'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  review:
    'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  clock:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
}

const CHECK_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'

const stats = [
  { iconKey: 'people',   headline: '700+',    label: 'STUDENTS SERVED'    },
  { iconKey: 'document', headline: 'Digital', label: 'FORM SUBMISSION'    },
  { iconKey: 'review',   headline: 'Review',  label: 'REGISTRAR WORKFLOW' },
  { iconKey: 'clock',    headline: 'Live',    label: 'STATUS UPDATES'     },
]

const previewSteps = [
  { number: 1, title: 'Personal Info',    status: 'completed'   },
  { number: 2, title: 'Course Selection', status: 'in-progress' },
  { number: 3, title: 'Final Review',     status: 'pending'     },
]

const STATUS_LABELS = {
  'completed':   'COMPLETED',
  'in-progress': 'IN PROGRESS',
  'pending':     'PENDING',
}

const BENEFIT_ICON_PATHS = {
  speed:
    'M7 2v11h3v9l7-12h-4l4-8z',
  digital:
    'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  review:
    'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
}

const benefitCards = [
  {
    iconKey:     'speed',
    title:       'Faster Registration',
    description: 'Students can complete registration online without waiting in long physical lines. Save time and avoid the stress of manual paperwork.',
    linkText:    'Learn More →',
  },
  {
    iconKey:     'digital',
    title:       'Digital Submission',
    description: 'Student information and required documents can be submitted securely through the portal. Organized validation helps reduce missing information.',
    linkText:    'Learn More →',
  },
  {
    iconKey:     'review',
    title:       'Registrar Review',
    description: 'Administrators can review, approve, reject, or request corrections digitally, creating a transparent and accountable review process.',
    linkText:    'Learn More →',
  },
]

const footerLinks = [
  { label: 'Privacy Policy',   href: '#' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Help Center',      href: '#' },
  { label: 'Contact Support',  href: '#' },
]

function StepIndicator({ number, status }) {
  if (status === 'completed') {
    return (
      <div className="step-indicator step-indicator--completed">
        <svg viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d={CHECK_PATH} />
        </svg>
      </div>
    )
  }
  return (
    <div className={`step-indicator step-indicator--${status}`}>
      {number}
    </div>
  )
}

function Home({ onNavigate }) {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero__content">
          <h1 className="hero__headline">
            Register Online.<br />
            <span className="hero__headline--accent">Skip the Long Line.</span>
          </h1>
          <p className="hero__description">
            Complete your student registration digitally and help reduce long
            in-person queues for students and registrar staff. Reliable, efficient,
            and mobile-friendly.
          </p>
          <div className="hero__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onNavigate('register')}
            >
              Start Registration
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => onNavigate('admin')}
            >
              View Admin Dashboard
            </button>
          </div>
        </div>

        <div className="portal-preview">
          <div className="portal-preview__header">
            <h2 className="portal-preview__title">Portal Preview</h2>
            <span className="portal-preview__badge">Active</span>
          </div>

          <div className="portal-preview__steps">
            {previewSteps.map(({ number, title, status }) => (
              <div key={number} className="preview-step">
                <div className="preview-step__row">
                  <StepIndicator number={number} status={status} />
                  <div className="preview-step__info">
                    <span className="preview-step__title">{title}</span>
                    <span className={`preview-step__status preview-step__status--${status}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                </div>
                <div className="step-progress">
                  <div className={`step-progress__fill step-progress__fill--${status}`} />
                </div>
              </div>
            ))}
          </div>

          <p className="portal-preview__queue">Live Queue: 0 mins</p>
        </div>
      </section>

      <section className="stats">
        {stats.map(({ iconKey, headline, label }) => (
          <div key={label} className="stat-card">
            <div className="stat-card__icon">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={STAT_ICON_PATHS[iconKey]} />
              </svg>
            </div>
            <span className="stat-card__headline">{headline}</span>
            <span className="stat-card__label">{label}</span>
          </div>
        ))}
      </section>

      {/* Benefit Cards */}
      <section className="benefits">
        <div className="benefits__grid">
          {benefitCards.map(({ iconKey, title, description, linkText }) => (
            <div key={title} className="benefit-card">
              <div className="benefit-card__icon">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d={BENEFIT_ICON_PATHS[iconKey]} />
                </svg>
              </div>
              <h3 className="benefit-card__title">{title}</h3>
              <p className="benefit-card__desc">{description}</p>
              <a href="#" className="benefit-card__link">{linkText}</a>
            </div>
          ))}
        </div>
      </section>

      {/* Campus Image Banner */}
      <section className="campus-banner">
        <div className="campus-banner__overlay">
          <div className="campus-banner__content">
            <h2 className="campus-banner__heading">Dedicated to Academic Excellence</h2>
            <p className="campus-banner__text">
              Join the students moving their academic registration experience into a secure digital workflow.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer__brand">
          <span className="footer__name">Livingstone College</span>
          <span className="footer__copy">© 2026 Livingstone College Student Registration Portal</span>
        </div>
        <nav className="footer__links" aria-label="Footer navigation">
          {footerLinks.map(({ label, href }) => (
            <a key={label} href={href} className="footer-link">
              {label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  )
}

export default Home
