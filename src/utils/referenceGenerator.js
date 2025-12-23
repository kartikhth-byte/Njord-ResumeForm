// src/utils/referenceGenerator.js

/**
 * Generates a unique reference number in format: NJD-XXXXXX
 * where XXXXXX is a 6-digit random number
 */
export const generateReferenceNumber = () => {
  const randomNumber = Math.floor(Math.random() * 1000000)
  const paddedNumber = randomNumber.toString().padStart(6, '0')
  return `NJD-${paddedNumber}`
}

/**
 * Validates reference number format
 */
export const isValidReferenceNumber = (refNumber) => {
  if (!refNumber) return false
  const pattern = /^NJD-\d{6}$/
  return pattern.test(refNumber)
}