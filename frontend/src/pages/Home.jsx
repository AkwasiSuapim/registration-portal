import { useState } from 'react'
import { STUDENT_REGISTRATION_PATH } from '../utils/routes'
import campusHero from '../assets/landing/campus-hero.jpg'

/* -------------------------------------------------------
   Static content for the landing page. Kept as plain data
   so the JSX below stays a straightforward render — nothing
   here talks to the API, this page is pure marketing/entry.
------------------------------------------------------- */

const statBar = [
  { value: '7',     label: 'Campus clearance offices'    },
  { value: '1',     label: 'Connected workflow'           },
  { value: 'Clear', label: 'Next-step guidance'            },
  { value: 'Live',  label: 'Real-time status visibility'   },
]

const howItWorksSteps = [
  {
    title: 'Complete your information',
    desc:  'Review your student details and submit the information required for registration.',
  },
  {
    title: 'Follow your clearances',
    desc:  'See the status of every participating campus office in one place.',
  },
  {
    title: 'Finish registration',
    desc:  'Resolve outstanding requirements and receive confirmation when registration is complete.',
  },
]

const BENEFIT_ICON_PATHS = {
  next:   ['M4 12h11', 'M11 7l5 5-5 5', 'M20 5v14'],
  track:  ['M12 8v4l3 2'],
  visits: ['M4 20V9l8-5 8 5v11', 'M9 20v-6h6v6'],
  earlier: ['M12 8v5', 'M12 16h.01'],
}

const benefits = [
  {
    iconKey: 'next',
    title:   'Know what to do next',
    desc:    'See the exact action required to move your registration forward.',
  },
  {
    iconKey: 'track',
    title:   'Track every clearance',
    desc:    'Monitor each participating office without visiting multiple locations for updates.',
    circle:  true,
  },
  {
    iconKey: 'visits',
    title:   'Reduce unnecessary office visits',
    desc:    'Complete available steps online and visit an office only when in-person action is required.',
  },
  {
    iconKey: 'earlier',
    title:   'Resolve problems earlier',
    desc:    'Identify missing information or blocked clearances before registration deadlines.',
    circle:  true,
  },
]

const officeNames = [
  'Registrar',
  'Health Services',
  'Success Center',
  'Financial Aid',
  'Business Office',
  'Residence Life',
  'Public Safety',
]

// Illustrative clearance statuses shown in the "Portal Preview" mockup
// below — sample content, not a live read from the backend.
const STATUS = {
  ok:     { label: 'Approved',        glyph: '✓', modifier: 'ok'     },
  action: { label: 'Action Required', glyph: '!',       modifier: 'action' },
  pending:{ label: 'Pending',         glyph: '•', modifier: 'pending' },
}

const officeStatuses = [
  { name: 'Registrar',        status: STATUS.ok      },
  { name: 'Health Services',  status: STATUS.ok      },
  { name: 'Success Center',   status: STATUS.ok      },
  { name: 'Financial Aid',    status: STATUS.action  },
  { name: 'Business Office',  status: STATUS.ok      },
  { name: 'Residence Life',   status: STATUS.ok      },
  { name: 'Public Safety',    status: STATUS.pending },
]

const faqs = [
  {
    q: 'Who can use the registration portal?',
    a: 'Currently enrolled and returning Livingstone College students with an active college account can use the portal to register and follow their clearances.',
  },
  {
    q: 'How do I access my account?',
    a: 'Sign in with your Livingstone College credentials. Accounts are issued by the college, so there is no public sign-up.',
  },
  {
    q: 'Can I save my progress and return later?',
    a: 'Yes. Your registration information is saved as you go, and you can sign back in to continue where you left off.',
  },
  {
    q: 'What does “Action Required” mean?',
    a: 'An office needs something from you before it can approve your clearance — usually a document, a payment arrangement, or a confirmation.',
  },
  {
    q: 'How will I know when an office approves my clearance?',
    a: 'The office status updates in your portal and you receive a notification, so you can see your overall completion move forward.',
  },
  {
    q: 'Who should I contact if I cannot sign in?',
    a: 'Contact the Registrar’s Office at 704-216-6001 or email info@livingstone.edu, and technical support can restore your access.',
  },
]

function BenefitIcon({ iconKey, circle }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {circle && <circle cx="12" cy="12" r="8" />}
      {BENEFIT_ICON_PATHS[iconKey].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

function FaqItem({ faq, isOpen, onToggle, index }) {
  const panelId = `faq-panel-${index}`
  return (
    <div className="faq-item">
      <button
        type="button"
        className="faq-item__question"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span>{faq.q}</span>
        <span className="faq-item__toggle" aria-hidden="true">{isOpen ? '–' : '+'}</span>
      </button>
      {isOpen && (
        <p id={panelId} className="faq-item__answer">{faq.a}</p>
      )}
    </div>
  )
}

function Home({ onNavigate }) {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <div className="home">

      {/* ============ Hero ============ */}
      <section className="hero" id="top" aria-label="Introduction">
        <div className="hero__decor" aria-hidden="true" />
        <div className="hero__inner">
          <div className="hero__content">
            <p className="hero__eyebrow">Livingstone College Registration</p>
            <h1 className="hero__headline">
              Complete registration{' '}
              <span className="hero__headline--accent">without the long lines.</span>
            </h1>
            <p className="hero__desc">
              Submit your information, follow every required campus clearance, and see
              exactly what needs your attention from one secure portal.
            </p>
            <div className="hero__actions">
              <button
                type="button"
                className="btn-lp btn-lp--primary"
                onClick={() => onNavigate(STUDENT_REGISTRATION_PATH)}
              >
                Start Registration
              </button>
              <a href="#how-it-works" className="btn-lp btn-lp--outline">
                See How It Works
              </a>
            </div>
            <p className="hero__signin">
              Already started?{' '}
              <button
                type="button"
                className="hero__signin-link"
                onClick={() => onNavigate('/login')}
              >
                Sign in to continue.
              </button>
            </p>
          </div>

          <div className="hero__visual">
            <div className="hero__blob">
              <div className="hero__blob-shape hero__blob-shape--back" />
              <div className="hero__blob-shape hero__blob-shape--mid" />
              <div className="hero__blob-outline" />
              <div className="hero__blob-photo">
                <img
                  className="hero__photo"
                  src={campusHero}
                  alt="Livingstone College students with President Anthony Davis at a campus event"
                />
              </div>
            </div>
            <div className="hero__status-card">
              <p className="hero__status-eyebrow">Fall Registration</p>
              <p className="hero__status-headline">5 of 7 offices cleared</p>
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: '71%' }} />
              </div>
              <p className="hero__status-next">Next step: <span>Financial Aid</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Stats bar ============ */}
      <section className="stats-bar" aria-label="Registration portal at a glance">
        <div className="stats-bar__grid">
          {statBar.map(({ value, label }) => (
            <div key={label} className="stats-bar__item">
              <p className="stats-bar__value">{value}</p>
              <p className="stats-bar__label">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ How it works ============ */}
      <section className="how-it-works" id="how-it-works">
        <div className="section-wrap">
          <h2 className="section-heading">How registration works</h2>
          <p className="section-subtext">
            Complete the process through one connected portal instead of moving between
            disconnected systems.
          </p>
          <div className="how-it-works__grid">
            {howItWorksSteps.map(({ title, desc }, i) => (
              <div key={title} className="how-step">
                <span className="how-step__dot" aria-hidden="true" />
                <p className="how-step__eyebrow">Step {i + 1}</p>
                <h3 className="how-step__title">{title}</h3>
                <p className="how-step__desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Status preview mockup ============ */}
      <section className="status-preview" aria-label="Sample registration status preview">
        <div className="section-wrap">
          <h2 className="section-heading">See exactly where your registration stands.</h2>
          <p className="section-subtext">
            No guessing, no disconnected forms, and no uncertainty about what comes next.
          </p>

          <div className="status-window">
            <div className="status-window__bar">
              <span className="status-window__dot" />
              <span className="status-window__dot" />
              <span className="status-window__dot" />
              <span className="status-window__url">portal.livingstone.edu/registration</span>
            </div>

            <div className="status-window__body">
              <div className="status-summary">
                <p className="status-summary__eyebrow">Fall 2026 Registration</p>
                <p className="status-summary__percent">71% complete</p>
                <p className="status-summary__note">5 of 7 offices cleared</p>
                <div className="progress-bar progress-bar--lg">
                  <div className="progress-bar__fill" style={{ width: '71%' }} />
                </div>
                <p className="status-summary__deadline">
                  Registration deadline &mdash; Friday, September 11, 2026
                </p>
                <div className="status-alert">
                  <span className="status-alert__icon" aria-hidden="true">!</span>
                  <span>
                    <span className="status-alert__title">Action required &mdash; Financial Aid</span>
                    <span className="status-alert__desc">Submit your verification worksheet to continue.</span>
                  </span>
                </div>
              </div>

              <div className="status-offices">
                <div className="status-offices__header">
                  <span>Office</span>
                  <span>Status</span>
                </div>
                {officeStatuses.map(({ name, status }) => (
                  <div key={name} className="status-offices__row">
                    <span>{name}</span>
                    <span className={`status-badge status-badge--${status.modifier}`}>
                      <span aria-hidden="true">{status.glyph}</span>
                      {status.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Benefits ============ */}
      <section className="benefits" id="benefits">
        <div className="section-wrap">
          <h2 className="section-heading">Registration made clearer for everyone.</h2>
          <div className="benefits__grid">
            {benefits.map(({ iconKey, title, desc, circle }) => (
              <div key={title} className="benefit">
                <span className="benefit__icon">
                  <BenefitIcon iconKey={iconKey} circle={circle} />
                </span>
                <span>
                  <span className="benefit__title">{title}</span>
                  <span className="benefit__desc">{desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Offices ============ */}
      <section className="offices" id="offices">
        <div className="section-wrap">
          <h2 className="section-heading">One portal. Seven connected offices.</h2>
          <p className="section-subtext">
            Each office reviews the requirements assigned to it while students can follow
            the complete registration process.
          </p>
          <div className="offices__grid">
            {officeNames.map((name) => (
              <div key={name} className="office-card">
                <span className="office-card__dot" aria-hidden="true" />
                <span className="office-card__name">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQs ============ */}
      <section className="faqs" id="faqs">
        <div className="section-wrap section-wrap--narrow">
          <h2 className="section-heading">Frequently asked questions</h2>
          <div className="faqs__list">
            {faqs.map((faq, i) => (
              <FaqItem
                key={faq.q}
                faq={faq}
                index={i}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="cta" id="signin">
        <div className="section-wrap cta__inner">
          <h2 className="cta__heading">Ready to complete your registration?</h2>
          <p className="cta__desc">
            Sign in to continue your registration and see what requires your attention.
          </p>
          <div className="cta__actions">
            <button
              type="button"
              className="btn-lp btn-lp--primary"
              onClick={() => onNavigate(STUDENT_REGISTRATION_PATH)}
            >
              Start Registration
            </button>
            <a href="#contact" className="btn-lp btn-lp--outline">
              Get Help
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}

export default Home
