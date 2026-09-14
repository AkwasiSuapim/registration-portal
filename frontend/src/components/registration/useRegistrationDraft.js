/* -------------------------------------------------------
   useRegistrationDraft.js
   -----------------------
   There is no draft-save endpoint on the backend (POST /applications
   is create-only — see registrationAdapter.js), so this wizard cannot
   truly save progress to the server between steps. Per the product
   requirement we still must not lose a student's typed answers while
   they move between steps or tabs, so the draft — everything except
   the raw File objects, which cannot be serialized — is kept in
   sessionStorage for the current browser tab only. It is cleared once
   the application is submitted, or if the student logs out.

   This is explicitly NOT a substitute for a real draft API: a page
   reload after the browser is closed, or opening the workspace in a
   different tab/device, will not recover the draft. That gap is
   reported to the user at the end of this task (see the final "missing
   API support" summary) rather than being papered over.
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
