import { validateSection } from './sectionValidation.js'
import { FORM_SECTION_NUMBERS, MANDATORY_SECTION_NUMBERS } from '../constants/formSections.js'

export function hasMeaningfulDraftData(data) {
  if (Array.isArray(data)) {
    return data.some((item) => hasMeaningfulDraftData(item))
  }

  if (!data || typeof data !== 'object') {
    if (typeof data === 'boolean') return data
    return data !== '' && data !== null && data !== undefined
  }

  return Object.values(data).some((value) => hasMeaningfulDraftData(value))
}

export function isDraftSectionComplete(sectionNumber, sectionData) {
  if (!hasMeaningfulDraftData(sectionData)) return false
  return validateSection(sectionNumber, sectionData).isValid
}

// One status per section, used by the dashboard, the form sidebar and the
// review page so they always agree.
// 'complete'   - has data and passes validation
// 'incomplete' - mandatory with no data, or has data that fails validation
// 'empty'      - optional and never opened (does not block submission)
// An optional section the applicant opened and left blank (e.g. no visas)
// counts as complete.
export function getSectionStatus(sectionNumber, sectionData) {
  if (!hasMeaningfulDraftData(sectionData)) {
    if (MANDATORY_SECTION_NUMBERS.includes(sectionNumber)) return 'incomplete'
    const opened = Boolean(sectionData) && typeof sectionData === 'object' && Object.keys(sectionData).length > 0
    return opened ? 'complete' : 'empty'
  }
  return validateSection(sectionNumber, sectionData).isValid ? 'complete' : 'incomplete'
}

export function getSectionStatuses(applicationData) {
  const data = applicationData || {}
  return Object.fromEntries(
    FORM_SECTION_NUMBERS.map((n) => [n, getSectionStatus(n, data[`section${n}`])])
  )
}

// Sections that block submission, in form order.
export function getBlockingSections(applicationData) {
  const statuses = getSectionStatuses(applicationData)
  return FORM_SECTION_NUMBERS.filter((n) => statuses[n] === 'incomplete')
}

// Progress toward submission: share of mandatory sections complete.
// 100% means the application can be submitted.
export function calculateApplicationProgress(applicationData) {
  const statuses = getSectionStatuses(applicationData)
  const done = MANDATORY_SECTION_NUMBERS.filter((n) => statuses[n] === 'complete').length
  return Math.round((done / MANDATORY_SECTION_NUMBERS.length) * 100)
}

// Where "Continue" should take the applicant: the first section that blocks
// submission, or null when everything required is done.
export function firstIncompleteSection(applicationData) {
  return getBlockingSections(applicationData)[0] ?? null
}

export function calculateDraftProgress(applicationData, sectionNumbers) {
  if (!applicationData) return 0

  const completedSections = sectionNumbers.filter((sectionNumber) => (
    isDraftSectionComplete(sectionNumber, applicationData[`section${sectionNumber}`])
  ))

  return Math.round((completedSections.length / sectionNumbers.length) * 100)
}
