// Canonical route paths shared across the app so every entry point
// (landing page, header nav, post-login redirect, the guard itself)
// agrees on where things live — there is exactly one place a student's
// registration destination is spelled out.
//
// The Student Workspace shell (StudentPortal.jsx) still runs its
// sections as in-memory tabs rather than full nested routes, but the
// Registration tab is also addressable at this URL directly so it can
// be linked to, redirected to, and reloaded like any other page.
export const STUDENT_PORTAL_PATH = '/student-portal'
export const STUDENT_REGISTRATION_PATH = '/student-portal/registration'
