import lcMark from '../assets/landing/lc-logo.png'

const YEAR = new Date().getFullYear()

/* -------------------------------------------------------
   Footer — one reusable footer used on every page.

   `variant="full"` (the public landing page) shows the complete brand
   block and registration-support contact details. `variant="compact"`
   (login, register, and the signed-in Student/Official workspaces)
   shows the same visual language — logo, portal name, Privacy /
   Accessibility / Support, copyright — in a single slim row so
   dashboards do not grow unnecessarily long.
------------------------------------------------------- */
function Footer({ variant = 'compact', onNavigate, isAuthenticated = false }) {
  const isFull = variant === 'full'

  return (
    <footer
      id={isFull ? 'contact' : undefined}
      className={`site-footer-v2${isFull ? ' site-footer-v2--full' : ' site-footer-v2--compact'}`}
    >
      <div className="site-footer-v2__inner">

        <div className="site-footer-v2__brand">
          <img className="site-footer-v2__mark" src={lcMark} alt="" />
          <div className="site-footer-v2__brand-text">
            <span className="site-footer-v2__name">Livingstone College</span>
            <span className="site-footer-v2__tagline">Student Registration &amp; Clearance Portal</span>
          </div>
        </div>

        {isFull && (
          <div className="site-footer-v2__contact">
            <p className="site-footer-v2__heading">Registration Support</p>
            <p className="site-footer-v2__address">
              701 W. Monroe Street, Salisbury, NC 28144<br />
              <a href="tel:7042166001">704-216-6001</a>
              {' · '}
              <a href="mailto:info@livingstone.edu">info@livingstone.edu</a>
            </p>
            {!isAuthenticated && onNavigate && (
              <button type="button" className="site-footer-v2__signin" onClick={() => onNavigate('/login')}>
                Sign In
              </button>
            )}
          </div>
        )}

        <div className="site-footer-v2__legal">
          <a href="#top">Privacy</a>
          <a href="#top">Accessibility</a>
          <a href="mailto:info@livingstone.edu">Support</a>
          <span className="site-footer-v2__copy">&copy; {YEAR} Livingstone College</span>
        </div>

      </div>
    </footer>
  )
}

export default Footer
