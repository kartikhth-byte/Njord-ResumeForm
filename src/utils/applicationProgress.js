import { validateSection } from './sectionValidation.js'

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

export function calculateDraftProgress(applicationData, sectionNumbers) {
  if (!applicationData) return 0

  const completedSections = sectionNumbers.filter((sectionNumber) => (
    isDraftSectionComplete(sectionNumber, applicationData[`section${sectionNumber}`])
  ))

  return Math.round((completedSections.length / sectionNumbers.length) * 100)
}
