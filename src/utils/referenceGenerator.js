// src/utils/referenceGenerator.js

// Brand-neutral prefix (was NJD-). Existing NJD- references stay valid.
const REFERENCE_PREFIX = 'REF'

/**
 * Generates a reference number in the format REF-XXXXXX
 * where XXXXXX is a 6-digit random number.
 */
export const generateReferenceNumber = () => {
  const randomNumber = Math.floor(Math.random() * 1000000)
  const paddedNumber = randomNumber.toString().padStart(6, '0')
  return `${REFERENCE_PREFIX}-${paddedNumber}`
}

/**
 * Validates reference number format (current REF- and legacy NJD-).
 */
export const isValidReferenceNumber = (refNumber) => {
  if (!refNumber) return false
  return /^(REF|NJD)-\d{6}$/.test(refNumber)
}
