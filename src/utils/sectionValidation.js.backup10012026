// Validation utility for all form sections
// This checks REQUIRED fields, not just if section has any data

/**
 * Validates Section 1: Availability & Application Details
 * Required fields:
 * - appliedForRank
 * - vesselType
 * - availableFrom
 * - mediaAdvertisementDetails (if mediaAdvertisement is true)
 * - recommendedBy (if professionalRecommendation is true)
 */
export const validateSection1 = (data) => {
  const errors = []
  
  if (!data.appliedForRank) {
    errors.push('Position applied for is required')
  }
  
  if (!data.vesselType) {
    errors.push('Vessel type is required')
  }
  
  if (!data.availableFrom) {
    errors.push('Available from date is required')
  }
  
  // Conditional validation
  if (data.mediaAdvertisement && !data.mediaAdvertisementDetails) {
    errors.push('Advertisement details are required when responding to media advertisement')
  }
  
  if (data.professionalRecommendation && !data.recommendedBy) {
    errors.push('Recommender name is required when applying upon recommendation')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 2: Personal & Contact Details
 * Required fields:
 * - surname
 * - firstName
 * - nationality
 * - placeOfBirth
 * - dateOfBirth
 * - gender
 * - email
 * - phoneCountryCode
 * - phoneNumber
 * - address
 * - city
 * - country
 * - postalCode
 * - maritalStatus
 * - nextOfKin.name
 * - nextOfKin.relationship
 * - emergencyContact.name
 * - emergencyContact.relationship
 * - emergencyContact.address
 * - emergencyContact.phone
 */
export const validateSection2 = (data) => {
  const errors = []
  
  // Basic personal info
  if (!data.surname) errors.push('Surname is required')
  if (!data.firstName) errors.push('First name is required')
  if (!data.nationality) errors.push('Nationality is required')
  if (!data.placeOfBirth) errors.push('Place of birth is required')
  if (!data.dateOfBirth) errors.push('Date of birth is required')
  if (!data.gender) errors.push('Gender is required')
  
  // Contact info
  if (!data.email) errors.push('Email is required')
  if (!data.phoneCountryCode) errors.push('Phone country code is required')
  if (!data.phoneNumber) errors.push('Phone number is required')
  if (!data.address) errors.push('Address is required')
  if (!data.city) errors.push('City is required')
  if (!data.country) errors.push('Country is required')
  if (!data.postalCode) errors.push('Postal code is required')
  if (!data.maritalStatus) errors.push('Marital status is required')
  
  // Next of kin
  if (!data.nextOfKin?.name) errors.push('Next of kin name is required')
  if (!data.nextOfKin?.relationship) errors.push('Next of kin relationship is required')
  
  // Emergency contact
  if (!data.emergencyContact?.name) errors.push('Emergency contact name is required')
  if (!data.emergencyContact?.relationship) errors.push('Emergency contact relationship is required')
  if (!data.emergencyContact?.address) errors.push('Emergency contact address is required')
  if (!data.emergencyContact?.phone) errors.push('Emergency contact phone is required')
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 3: Passport Details
 * Required fields:
 * - passportNumber
 * - placeOfIssue
 * - issuingAuthority
 * - dateOfIssue
 * - dateOfExpiry
 * Note: Nationality is captured in Section 2
 */
export const validateSection3 = (data) => {
  const errors = []
  
  if (!data.passportNumber) {
    errors.push('Passport number is required')
  }
  
  if (!data.placeOfIssue) {
    errors.push('Place of issue is required')
  }
  
  if (!data.issuingAuthority) {
    errors.push('Issuing authority is required')
  }
  
  if (!data.dateOfIssue) {
    errors.push('Date of issue is required')
  }
  
  if (!data.dateOfExpiry) {
    errors.push('Date of expiry is required')
  }
  
  // Date logic validation
  if (data.dateOfExpiry && data.dateOfIssue && data.dateOfExpiry <= data.dateOfIssue) {
    errors.push('Expiry date must be after issue date')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 4: CDC / National Seaman's Book
 * Required fields:
 * - cdcNumber
 * - placeOfIssue
 * - issuingAuthority
 * - dateOfIssue
 * - dateOfExpiry
 */
export const validateSection4 = (data) => {
  const errors = []
  
  if (!data.cdcNumber) {
    errors.push('CDC/Seaman\'s book number is required')
  }
  
  if (!data.placeOfIssue) {
    errors.push('Place of issue is required')
  }
  
  if (!data.issuingAuthority) {
    errors.push('Issuing authority is required')
  }
  
  if (!data.dateOfIssue) {
    errors.push('Date of issue is required')
  }
  
  if (!data.dateOfExpiry) {
    errors.push('Date of expiry is required')
  }
  
  // Date logic validation
  if (data.dateOfExpiry && data.dateOfIssue && data.dateOfExpiry <= data.dateOfIssue) {
    errors.push('Expiry date must be after issue date')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 6: Education Background
 * Required: At least one education entry with required fields
 */
export const validateSection6 = (data) => {
  const errors = []
  
  if (!data.education || !Array.isArray(data.education) || data.education.length === 0) {
    errors.push('At least one education entry is required')
    return { isValid: false, errors }
  }
  
  // Check each entry
  data.education.forEach((entry, index) => {
    if (!entry.institution) errors.push(`Education ${index + 1}: Institution name is required`)
    if (!entry.qualification) errors.push(`Education ${index + 1}: Qualification is required`)
    if (!entry.from) errors.push(`Education ${index + 1}: Start date is required`)
    if (!entry.to) errors.push(`Education ${index + 1}: End date is required`)
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 8: National Certificates of Competency
 * Required: At least one certificate with required fields
 */
export const validateSection8 = (data) => {
  const errors = []
  
  if (!data.certificates || !Array.isArray(data.certificates) || data.certificates.length === 0) {
    errors.push('At least one certificate is required')
    return { isValid: false, errors }
  }
  
  data.certificates.forEach((cert, index) => {
    if (!cert.grade) errors.push(`Certificate ${index + 1}: Grade/rank is required`)
    if (!cert.certificateNumber) errors.push(`Certificate ${index + 1}: Number is required`)
    if (!cert.issuingAuthority) errors.push(`Certificate ${index + 1}: Issuing authority is required`)
    if (!cert.placeOfIssue) errors.push(`Certificate ${index + 1}: Place of issue is required`)
    if (!cert.dateOfIssue) errors.push(`Certificate ${index + 1}: Date of issue is required`)
    if (!cert.dateOfExpiry) errors.push(`Certificate ${index + 1}: Date of expiry is required`)
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 10: Medical Fitness & Vaccination
 * Required fields based on section structure
 */
/**
 * Validates Section 10: Medical Fitness & Vaccination
 * Required: At least one medical certificate
 */
export const validateSection10 = (data) => {
  const errors = []
  
  // Check for at least one medical fitness certificate
  if (!data.medicalFitness || !Array.isArray(data.medicalFitness) || data.medicalFitness.length === 0) {
    errors.push('At least one medical fitness certificate is required')
    return { isValid: false, errors }
  }
  
  // Validate each medical certificate
  data.medicalFitness.forEach((medical, index) => {
    if (!medical.type) errors.push(`Medical Certificate ${index + 1}: Type is required`)
    if (!medical.dateOfIssue) errors.push(`Medical Certificate ${index + 1}: Date of issue is required`)
    if (!medical.dateOfExpiry) errors.push(`Medical Certificate ${index + 1}: Date of expiry is required`)
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 11: Medical History
 * Required: Must declare if signed off medical (boolean field)
 * If signedOffMedical is true, additional fields are required
 * Data structure: { medicalHistory: { signedOffMedical, vesselName, dateOfOccurrence, description } }
 */
export const validateSection11 = (data) => {
  const errors = []
  
  // Check if medicalHistory object exists
  if (!data.medicalHistory) {
    errors.push('Medical history declaration is required')
    return { isValid: false, errors }
  }
  
  if (data.medicalHistory.signedOffMedical === undefined) {
    errors.push('Medical history declaration is required')
    return { isValid: false, errors }
  }
  
  // If signed off medical, check required fields
  if (data.medicalHistory.signedOffMedical === true) {
    if (!data.medicalHistory.vesselName) errors.push('Vessel name is required')
    if (!data.medicalHistory.dateOfOccurrence) errors.push('Date of occurrence is required')
    if (!data.medicalHistory.description) errors.push('Description is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 13: Physical & Uniform Details
 * Required fields: height, weight, etc.
 */
export const validateSection13 = (data) => {
  const errors = []
  
  if (!data.height) errors.push('Height is required')
  if (!data.weight) errors.push('Weight is required')
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 14: STCW Courses & Competencies
 * Required: At least one course
 */
/**
 * Validates Section 14: STCW & Marine Courses
 * Required: At least one course with all required fields
 */
export const validateSection14 = (data) => {
  const errors = []
  
  if (!data.courses || !Array.isArray(data.courses) || data.courses.length === 0) {
    errors.push('At least one STCW course is required')
    return { isValid: false, errors }
  }
  
  data.courses.forEach((course, index) => {
    if (!course.courseName) errors.push(`Course ${index + 1}: Name is required`)
    if (!course.issuingAuthority) errors.push(`Course ${index + 1}: Issuing authority is required`)
    if (!course.certificateNumber) errors.push(`Course ${index + 1}: Certificate number is required`)
    if (!course.placeOfIssue) errors.push(`Course ${index + 1}: Place of issue is required`)
    if (!course.dateOfIssue) errors.push(`Course ${index + 1}: Date of issue is required`)
    if (!course.dateOfExpiry) errors.push(`Course ${index + 1}: Date of expiry is required`)
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 16: Sea Service / Employment History
 * Required: At least one sea service entry with all required fields
 */
export const validateSection16 = (data) => {
  const errors = []
  
  if (!data.seaService || !Array.isArray(data.seaService) || data.seaService.length === 0) {
    errors.push('At least one sea service entry is required')
    return { isValid: false, errors }
  }
  
  data.seaService.forEach((service, index) => {
    if (!service.vesselName) errors.push(`Sea Service ${index + 1}: Vessel name is required`)
    if (!service.vesselType) errors.push(`Sea Service ${index + 1}: Vessel type is required`)
    if (!service.flag) errors.push(`Sea Service ${index + 1}: Flag is required`)
    if (!service.grt) errors.push(`Sea Service ${index + 1}: GRT is required`)
    if (!service.mainEngine) errors.push(`Sea Service ${index + 1}: Main engine type is required`)
    if (!service.rankHeld) errors.push(`Sea Service ${index + 1}: Rank held is required`)
    if (!service.companyName) errors.push(`Sea Service ${index + 1}: Company name is required`)
    if (!service.signOnDate) errors.push(`Sea Service ${index + 1}: Sign on date is required`)
    if (!service.signOffDate) errors.push(`Sea Service ${index + 1}: Sign off date is required`)
    if (!service.tradeRoute) errors.push(`Sea Service ${index + 1}: Trade route is required`)
    if (!service.reasonForLeaving) errors.push(`Sea Service ${index + 1}: Reason for leaving is required`)
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 18: Professional References
 * Required: At least two references with all required fields
 */
export const validateSection18 = (data) => {
  const errors = []
  
  if (!data.references || !Array.isArray(data.references) || data.references.length < 2) {
    errors.push('At least two professional references are required')
    return { isValid: false, errors }
  }
  
  data.references.forEach((ref, index) => {
    if (!ref.name) errors.push(`Reference ${index + 1}: Name is required`)
    if (!ref.position) errors.push(`Reference ${index + 1}: Position is required`)
    if (!ref.company) errors.push(`Reference ${index + 1}: Company is required`)
    if (!ref.relationship) errors.push(`Reference ${index + 1}: Relationship is required`)
    if (!ref.phoneNumber) errors.push(`Reference ${index + 1}: Phone number is required`)
    if (!ref.email) errors.push(`Reference ${index + 1}: Email is required`)
    if (!ref.yearsKnown) errors.push(`Reference ${index + 1}: Years known is required`)
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 19: Emergency Contact Information
 * (Already validated in Section 2, but check if standalone)
 */
/**
 * Validates Section 19: Emergency Contact Information
 * Required: At least one emergency contact with all required fields
 * Data structure: { contacts: [...] } (not emergencyContacts!)
 */
export const validateSection19 = (data) => {
  const errors = []
  
  if (!data.contacts || !Array.isArray(data.contacts) || data.contacts.length === 0) {
    errors.push('At least one emergency contact is required')
    return { isValid: false, errors }
  }
  
  data.contacts.forEach((contact, index) => {
    if (!contact.fullName) errors.push(`Contact ${index + 1}: Full name is required`)
    if (!contact.relationship) errors.push(`Contact ${index + 1}: Relationship is required`)
    if (!contact.phoneNumber) errors.push(`Contact ${index + 1}: Phone number is required`)
    if (!contact.email) errors.push(`Contact ${index + 1}: Email is required`)
    if (!contact.address) errors.push(`Contact ${index + 1}: Address is required`)
    if (!contact.city) errors.push(`Contact ${index + 1}: City is required`)
    if (!contact.country) errors.push(`Contact ${index + 1}: Country is required`)
    if (!contact.postalCode) errors.push(`Contact ${index + 1}: Postal code is required`)
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates Section 20: Additional Information & Declarations
 * Required: All declarations must be checked, signature fields must be filled
 */
export const validateSection20 = (data) => {
  const errors = []
  
  // Declarations
  if (!data.accuracyDeclaration) {
    errors.push('You must declare that all information is accurate')
  }
  if (!data.backgroundCheckConsent) {
    errors.push('Background check consent is required')
  }
  if (!data.dataProcessingConsent) {
    errors.push('Data processing consent is required')
  }
  
  // Signature fields
  if (!data.fullName) errors.push('Full name for signature is required')
  if (!data.signatureDate) errors.push('Signature date is required')
  if (!data.placeOfSigning) errors.push('Place of signing is required')
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Master validation function - validates a specific section
 */
export const validateSection = (sectionNumber, data) => {
  if (!data) {
    return {
      isValid: false,
      errors: ['Section has no data']
    }
  }
  
  switch (sectionNumber) {
    case 1: return validateSection1(data)
    case 2: return validateSection2(data)
    case 3: return validateSection3(data)
    case 4: return validateSection4(data)
    case 6: return validateSection6(data)
    case 8: return validateSection8(data)
    case 10: return validateSection10(data)
    case 11: return validateSection11(data)
    case 13: return validateSection13(data)
    case 14: return validateSection14(data)
    case 16: return validateSection16(data)
    case 18: return validateSection18(data)
    case 19: return validateSection19(data)
    case 20: return validateSection20(data)
    
    // Optional sections (5, 7, 9, 12, 15, 17) - always valid
    default:
      return {
        isValid: true,
        errors: []
      }
  }
}

/**
 * Validates all mandatory sections
 */
export const validateAllMandatorySections = (applicationData) => {
  const MANDATORY_SECTIONS = [1, 2, 3, 4, 6, 8, 10, 11, 13, 14, 16, 18, 19, 20]
  
  const invalidSections = []
  const allErrors = {}
  
  MANDATORY_SECTIONS.forEach(sectionNum => {
    const sectionData = applicationData[`section${sectionNum}`]
    const validation = validateSection(sectionNum, sectionData)
    
    if (!validation.isValid) {
      invalidSections.push(sectionNum)
      allErrors[sectionNum] = validation.errors
    }
  })
  
  return {
    isValid: invalidSections.length === 0,
    invalidSections,
    errors: allErrors
  }
}