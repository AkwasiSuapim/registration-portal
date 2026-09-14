/* -------------------------------------------------------
   useRegistrationDraft.js
   -----------------------
   The backend is now the real source of truth for a registration draft
   (GET/POST /registrations, PATCH .../sections/{section} — see
   RegistrationWizard.jsx): every Save & Continue persists the step just
   completed, and resuming later re-fetches and re-hydrates from there
   (registrationAdapter.js's hydrateStateFromRegistration), which is what
   makes "no duplicate drafts on refresh / return later, even from a
   different device" actually true.

   This sessionStorage layer still exists underneath that as a same-tab
   typing buffer: whatever the student has typed into the CURRENT step
   but not yet saved (they haven't clicked Save & Continue yet) survives
   an accidental reload of this tab. It is cleared once the registration
   is submitted, or if the student logs out. A raw File object still
   can't be serialized into it, so an in-progress upload's file itself
   does not survive a same-tab reload — see reviveWizardState below for
   how that's surfaced honestly (an 'error' slot asking the student to
   re-select the file) rather than silently dropped.
------------------------------------------------------- */
import { useEffect, useState } from 'react'

const STORAGE_PREFIX = 'registrationWizardDraft:'

// Upload slots hold a File object, which cannot be JSON-serialized —
// strip it before saving and simply mark the slot as needing re-selection
// after a reload. Everything else in the slot (status/name/error) is
// kept so the UI can still show what was previously attempted.
function stripFilesForStorage(value) {
  if (Array.isArray(value)) return value.map(stripFilesForStorage)
  if (value && typeof value === 'object') {
    if (typeof File !== 'undefined' && value instanceof File) return undefined
    const clone = {}
    for (const [key, val] of Object.entries(value)) {
      if (key === 'file') continue // File objects are dropped on purpose
      clone[key] = stripFilesForStorage(val)
    }
    return clone
  }
  return value
}

function loadDraft(storageKey, fallback) {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

// state persists to sessionStorage on every change; clearDraft removes it
// (call after a successful submission so a later registration starts fresh).
export function useRegistrationDraft(studentKey, createInitial, reviveLoaded) {
  const storageKey = `${STORAGE_PREFIX}${studentKey || 'anonymous'}`
  // Lazy initializer — runs once on mount, so reading sessionStorage never
  // happens during a normal render.
  const [state, setState] = useState(() => {
    const loaded = loadDraft(storageKey, createInitial())
    return reviveLoaded ? reviveLoaded(loaded) : loaded
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(stripFilesForStorage(state)))
    } catch {
      // sessionStorage can throw in private-browsing contexts — the wizard
      // still works in-memory for the rest of the session, it just won't
      // survive a tab reload.
    }
  }, [state, storageKey])

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  return [state, setState, clearDraft]
}
