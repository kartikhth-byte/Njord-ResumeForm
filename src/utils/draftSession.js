const ACTIVE_DRAFT_STORAGE_KEY = 'njord-active-draft-id'
const ACTIVE_DRAFT_EXPLICIT_STORAGE_KEY = 'njord-active-draft-explicit'

export function getActiveDraftId() {
  try {
    return window.localStorage.getItem(ACTIVE_DRAFT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setActiveDraftId(applicationId) {
  try {
    if (!applicationId) {
      window.localStorage.removeItem(ACTIVE_DRAFT_STORAGE_KEY)
      window.localStorage.removeItem(ACTIVE_DRAFT_EXPLICIT_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(ACTIVE_DRAFT_STORAGE_KEY, applicationId)
  } catch {
    // Ignore storage write failures
  }
}

export function clearActiveDraftId() {
  try {
    window.localStorage.removeItem(ACTIVE_DRAFT_STORAGE_KEY)
    window.localStorage.removeItem(ACTIVE_DRAFT_EXPLICIT_STORAGE_KEY)
  } catch {
    // Ignore storage clear failures
  }
}

export function markActiveDraftExplicit(isExplicit) {
  try {
    if (!isExplicit) {
      window.localStorage.removeItem(ACTIVE_DRAFT_EXPLICIT_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(ACTIVE_DRAFT_EXPLICIT_STORAGE_KEY, 'true')
  } catch {
    // Ignore storage write failures
  }
}

export function isActiveDraftExplicit() {
  try {
    return window.localStorage.getItem(ACTIVE_DRAFT_EXPLICIT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
