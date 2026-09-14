/* -------------------------------------------------------
   officialLocalState.js
   -----------------------
   Isolated frontend placeholder for two Official Workspace features
   that have NO backend support today:

     1. Per-official "claim" of a queue item ("Assign to Me" /
        "Assigned to Me" / "Unassigned"). The backend's Clearance model
        has no assigned-official column — a clearance belongs to an
        OFFICE ROLE, not to one specific staff member (see
        backend/app/models/clearance.py). There is no
        POST/PATCH endpoint to record who on the team picked up a item.

     2. "Save Review as Draft" — POST /clearances/{id} only accepts the
        four final actions (approve / request_correction / reject /
        mark_in_person_required); there is no draft-save endpoint and no
        column to hold an in-progress comment.

   Both are kept in localStorage, scoped to the signed-in official's
   user id, so they survive a reload on THIS device only. They are
   NEVER sent to the server and NEVER presented as a saved server
   state — every place that reads this module labels it as local-only.
   This is reported as missing API support in the feature's final
   summary rather than being silently faked.
------------------------------------------------------- */

const CLAIMS_PREFIX = 'officialClaims:'
const DRAFTS_PREFIX = 'officialReviewDrafts:'

function readMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {}
  } catch {
    return {}
  }
}

function writeMap(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map))
  } catch {
    // localStorage can throw in private-browsing contexts — claims/drafts
    // simply won't persist past this page view in that case.
  }
}

/* ─── Claims ("Assign to Me") ──────────────────────────────────── */

export function getClaimedClearanceIds(officialUserId) {
  return Object.keys(readMap(`${CLAIMS_PREFIX}${officialUserId}`))
}

export function isClaimed(officialUserId, clearanceId) {
  return Boolean(readMap(`${CLAIMS_PREFIX}${officialUserId}`)[clearanceId])
}

export function claim(officialUserId, clearanceId) {
  const key = `${CLAIMS_PREFIX}${officialUserId}`
  const map = readMap(key)
  map[clearanceId] = { claimedAt: new Date().toISOString() }
  writeMap(key, map)
}

export function unclaim(officialUserId, clearanceId) {
  const key = `${CLAIMS_PREFIX}${officialUserId}`
  const map = readMap(key)
  delete map[clearanceId]
  writeMap(key, map)
}

/* ─── Review drafts ("Save Review as Draft") ───────────────────── */

export function getDraft(officialUserId, clearanceId) {
  return readMap(`${DRAFTS_PREFIX}${officialUserId}`)[clearanceId] || null
}

export function saveDraft(officialUserId, clearanceId, comment) {
  const key = `${DRAFTS_PREFIX}${officialUserId}`
  const map = readMap(key)
  map[clearanceId] = { comment, savedAt: new Date().toISOString() }
  writeMap(key, map)
}

export function clearDraft(officialUserId, clearanceId) {
  const key = `${DRAFTS_PREFIX}${officialUserId}`
  const map = readMap(key)
  delete map[clearanceId]
  writeMap(key, map)
}
