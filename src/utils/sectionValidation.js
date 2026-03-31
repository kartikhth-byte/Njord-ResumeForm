/* eslint-disable no-unused-vars */
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
    if (!course.certificateNumber) errors.push(`Course ${index + 1}: Certificate number is required`)
    if (!course.dateOfIssue) errors.push(`Course ${index + 1}: Date of issue is required`)
    if (!course.dateOfExpiry) errors.push(`Course ${index + 1}: Date of expiry is required`)
    if (course.dateOfIssue && course.dateOfExpiry && course.dateOfExpiry <= course.dateOfIssue) {
      errors.push(`Course ${index + 1}: Expiry date must be after issue date`)
    }
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
    if (!service.teu) errors.push(`Sea Service ${index + 1}: TEU is required`)
    if (!service.yearBuilt) errors.push(`Sea Service ${index + 1}: Year built is required`)
    if (!service.mainEngine) errors.push(`Sea Service ${index + 1}: Main engine type is required`)
    if (!service.engineFamily) errors.push(`Sea Service ${index + 1}: Engine family is required`)
    if (!service.mainEngineMake) errors.push(`Sea Service ${index + 1}: Main engine make is required`)
    if (!service.rankHeld) errors.push(`Sea Service ${index + 1}: Rank held is required`)
    if (!service.position) errors.push(`Sea Service ${index + 1}: Position is required`)
    if (!service.company && !service.companyName) errors.push(`Sea Service ${index + 1}: Company is required`)
    if (!service.manning) errors.push(`Sea Service ${index + 1}: Manning is required`)
    if (!service.signOnDate) errors.push(`Sea Service ${index + 1}: Sign on date is required`)
    if (!service.signOffDate) errors.push(`Sea Service ${index + 1}: Sign off date is required`)
    if (!service.tradingArea && !service.tradeRoute) errors.push(`Sea Service ${index + 1}: Trading area is required`)
    if (!service.tradeRoute) errors.push(`Sea Service ${index + 1}: Trade route is required`)
    if (!service.totalMmDd) errors.push(`Sea Service ${index + 1}: Total mm/dd is required`)
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

  if (!data.objectionToContactLastEmployer) {
    errors.push('Please specify whether we may contact your last employer')
  }

  if (!data.currentEmployer?.company) errors.push('Current or immediate past employer: Company is required')
  if (!data.currentEmployer?.contactPerson) errors.push('Current or immediate past employer: Contact person is required')
  if (!data.currentEmployer?.address) errors.push('Current or immediate past employer: Address is required')
  if (!data.currentEmployer?.phoneNumber) errors.push('Current or immediate past employer: Phone number is required')
  
  if (!data.references || !Array.isArray(data.references) || data.references.length < 2) {
    errors.push('At least two professional references are required')
    return { isValid: false, errors }
  }
  
  data.references.forEach((ref, index) => {
    if (!ref.name) errors.push(`Reference ${index + 1}: Name is required`)
    if (!ref.position) errors.push(`Reference ${index + 1}: Position is required`)
    if (!ref.company) errors.push(`Reference ${index + 1}: Company is required`)
    if (!ref.address) errors.push(`Reference ${index + 1}: Address is required`)
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
 * Validates Section 19: Additional Information & Declarations
 * Required: All declarations must be checked, signature fields must be filled
 */
export const validateSection19 = (data) => {
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
  const MANDATORY_SECTIONS = [1, 2, 3, 4, 6, 8, 10, 11, 13, 14, 16, 18, 19]
  
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
// =============================================================================
// FIELD-LEVEL VALIDATION FUNCTIONS (ADDED FOR REAL-TIME VALIDATION)
// =============================================================================

/**
 * Validate individual field in Section 1
 * Returns error message or empty string
 */
export const validateSection1Field = (fieldName, value, formData = {}) => {
  switch (fieldName) {
    case 'appliedForRank':
      return !value ? 'Position applied for is required' : ''
    case 'vesselType':
      return !value ? 'Vessel type is required' : ''
    case 'availableFrom':
      return !value ? 'Available from date is required' : ''
    case 'mediaAdvertisementDetails':
      return formData.mediaAdvertisement && !value 
        ? 'Advertisement details are required' 
        : ''
    case 'recommendedBy':
      return formData.professionalRecommendation && !value
        ? 'Recommender name is required'
        : ''
    default:
      return ''
  }
}

/**
 * Validate individual field in Section 2
 */
export const validateSection2Field = (fieldName, value, formData = {}) => {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  switch (fieldName) {
    case 'surname':
      return !value ? 'Surname is required' : ''
    case 'firstName':
      return !value ? 'First name is required' : ''
    case 'nationality':
      return !value ? 'Nationality is required' : ''
    case 'placeOfBirth':
      return !value ? 'Place of birth is required' : ''
    case 'dateOfBirth':
      return !value ? 'Date of birth is required' : ''
    case 'gender':
      return !value ? 'Gender is required' : ''
    case 'email':
      if (!value) return 'Email is required'
      if (!EMAIL_REGEX.test(value)) return 'Please enter a valid email address'
      return ''
    case 'phoneNumber':
      if (!value) return 'Phone number is required'
      if (value.length < 8) return 'Please enter a valid phone number'
      return ''
    case 'address':
      return !value ? 'Address is required' : ''
    case 'city':
      return !value ? 'City is required' : ''
    case 'country':
      return !value ? 'Country is required' : ''
    case 'postalCode':
      return !value ? 'Postal code is required' : ''
    case 'maritalStatus':
      return !value ? 'Marital status is required' : ''
    default:
      return ''
  }
}

/**
 * Validate individual field in Section 3 (Passport)
 */
export const validateSection3Field = (fieldName, value, formData = {}) => {
  switch (fieldName) {
    case 'passportNumber':
      return !value ? 'Passport number is required' : ''
    case 'placeOfIssue':
      return !value ? 'Place of issue is required' : ''
    case 'dateOfIssue':
      return !value ? 'Date of issue is required' : ''
    case 'dateOfExpiry':
      if (!value) return 'Date of expiry is required'
      if (value && formData.dateOfIssue) {
        const issueDate = new Date(formData.dateOfIssue)
        const expiryDate = new Date(value)
        if (expiryDate <= issueDate) {
          return 'Expiry date must be after issue date'
        }
      }
      return ''
    case 'issuingAuthority':
      return !value ? 'Issuing authority is required' : ''
    default:
      return ''
  }
}

/**
 * Validate individual field in Section 4 (CDC)
 */
export const validateSection4Field = (fieldName, value, formData = {}) => {
  switch (fieldName) {
    case 'cdcNumber':
      return !value ? 'CDC/Seaman book number is required' : ''
    case 'placeOfIssue':
      return !value ? 'Place of issue is required' : ''
    case 'dateOfIssue':
      return !value ? 'Date of issue is required' : ''
    case 'dateOfExpiry':
      if (!value) return 'Date of expiry is required'
      if (value && formData.dateOfIssue) {
        const issueDate = new Date(formData.dateOfIssue)
        const expiryDate = new Date(value)
        if (expiryDate <= issueDate) {
          return 'Expiry date must be after issue date'
        }
      }
      return ''
    case 'issuingAuthority':
      return !value ? 'Issuing authority is required' : ''
    default:
      return ''
  }
}

/**
 * Validate individual field in Section 13 (Physical & Uniform)
 */
export const validateSection13Field = (fieldName, value, formData = {}) => {
  switch (fieldName) {
    case 'height':
      if (!value) return 'Height is required'
      if (Number(value) <= 0) return 'Please enter a valid height'
      return ''
    case 'weight':
      if (!value) return 'Weight is required'
      if (Number(value) <= 0) return 'Please enter a valid weight'
      return ''
    case 'hairColor':
      return !value ? 'Hair color is required' : ''
    case 'eyeColor':
      return !value ? 'Eye color is required' : ''
    case 'shoeSize':
      return !value ? 'Shoe size is required' : ''
    case 'shoeSizeUnit':
      return !value ? 'Shoe size unit is required' : ''
    case 'boilerSuitSize':
      return !value ? 'Boiler suit size is required' : ''
    case 'uniformShirtSize':
      return !value ? 'Uniform shirt size is required' : ''
    case 'uniformTrouserSize':
      return !value ? 'Uniform trouser size is required' : ''
    default:
      return ''
  }
}

/**
 * Get the appropriate field validator function for a section
 */
export const getFieldValidator = (sectionNumber) => {
  switch (sectionNumber) {
    case 1: return validateSection1Field
    case 2: return validateSection2Field
    case 3: return validateSection3Field
    case 4: return validateSection4Field
    case 13: return validateSection13Field
    default: return () => ''
  }
}

/**
 * Validate a single field in any section
 */
export const validateFieldInSection = (sectionNumber, fieldName, value, formData = {}) => {
  const validator = getFieldValidator(sectionNumber)
  return validator(fieldName, value, formData)
}
