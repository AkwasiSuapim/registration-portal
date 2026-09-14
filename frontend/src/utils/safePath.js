// isSafeInternalPath — guards every "return to this page after login"
// value before it's ever handed to navigate(). It only accepts a path
// rooted at this app's own origin: a single leading "/" is required,
// and both "//host/..." (protocol-relative) and "scheme://host/..."
// are rejected so a crafted redirect target can never send a visitor
// off the site after they authenticate.
const EXTERNAL_TARGET = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i

export function isSafeInternalPath(path) {
  return typeof path === 'string' && path.startsWith('/') && !EXTERNAL_TARGET.test(path)
}
