import { test, expect } from '@playwright/test'
import {
  validateSection,
  validateAllMandatorySections,
  validateFieldInSection,
} from '../../src/utils/sectionValidation.js'
import { SECTION14_COURSE_METADATA } from '../../src/constants/section14Courses.js'

const validSections = {
  section1: {
    appliedForRank: 'Chief Officer',
    vesselType: 'Container',
    availableFrom: '2026-04-01',
    mediaAdvertisement: false,
    professionalRecommendation: false,
  },
  section2: {
    surname: 'Doe',
    firstName: 'John',
    nationality: 'Indian',
    placeOfBirth: 'Mumbai',
    dateOfBirth: '1990-01-15',
    gender: 'male',
    email: 'john.doe@example.com',
    phoneCountryCode: '+91',
    phoneNumber: '9876543210',
    address: '221B Maritime Avenue',
    city: 'Mumbai',
    country: 'india',
    postalCode: '400001',
    maritalStatus: 'single',
    nextOfKin: {
      name: 'Jane Doe',
      relationship: 'parent',
    },
    emergencyContact: {
      name: 'Jack Doe',
      relationship: 'sibling',
      address: '221B Maritime Avenue',
      phone: '9876543211',
    },
  },
  section3: {
    passportNumber: 'A1234567',
    placeOfIssue: 'Mumbai',
    issuingAuthority: 'Passport Office',
    dateOfIssue: '2024-01-01',
    dateOfExpiry: '2034-01-01',
  },
  section4: {
    cdcNumber: 'CDC12345',
    placeOfIssue: 'Mumbai',
    issuingAuthority: 'DG Shipping',
    dateOfIssue: '2024-01-01',
    dateOfExpiry: '2034-01-01',
  },
  section6: {
    education: [
      {
        institution: 'Maritime Academy',
        qualification: 'BSc Nautical Science',
        from: '2010-06-01',
        to: '2013-05-31',
      },
    ],
  },
  section8: {
    certificates: [
      {
        grade: 'Chief Officer',
        certificateNumber: 'COC-12345',
        issuingAuthority: 'MCA',
        placeOfIssue: 'Mumbai',
        dateOfIssue: '2024-01-01',
        dateOfExpiry: '2029-01-01',
      },
    ],
  },
  section10: {
    medicalFitness: [
      {
        type: 'PEME',
        dateOfIssue: '2025-01-01',
        dateOfExpiry: '2026-01-01',
      },
    ],
  },
  section11: {
    medicalHistory: {
      signedOffMedical: false,
    },
  },
  section13: {
    height: '178',
    weight: '78',
  },
  section14: {
    courses: [
      {
        courseName: 'Basic Training',
        imoModelCourse: SECTION14_COURSE_METADATA['Basic Training'].imoModelCourse,
        referenceRegulation: SECTION14_COURSE_METADATA['Basic Training'].referenceRegulation,
        certificateNumber: 'STCW-100',
        dateOfIssue: '2025-01-01',
        dateOfExpiry: '2030-01-01',
      },
    ],
  },
  section16: {
    seaService: [
      {
        vesselName: 'MV Test Voyager',
        vesselType: 'GC',
        flag: 'India',
        grt: '25000',
        teu: '4500',
        yearBuilt: '2018',
        mainEngine: 'Diesel',
        mainEngineMake: 'MAN B&W',
        rankHeld: 'Chief Officer',
        position: 'Chief Officer',
        company: 'Njord Marine',
        companyName: 'Njord Marine',
        manning: 'V.Ships',
        signOnDate: '2024-01-01',
        signOffDate: '2024-08-15',
        tradingArea: 'Worldwide',
        tradeRoute: 'Worldwide',
        totalMmDd: '08/15',
        reasonForLeaving: 'EOC',
      },
    ],
  },
  section18: {
    references: [
      {
        name: 'Ref One',
        position: 'Master',
        company: 'Company A',
        relationship: 'Supervisor',
        phoneNumber: '9876543210',
        email: 'ref1@example.com',
        yearsKnown: '4',
      },
      {
        name: 'Ref Two',
        position: 'Chief Officer',
        company: 'Company B',
        relationship: 'Colleague',
        phoneNumber: '9876543211',
        email: 'ref2@example.com',
        yearsKnown: '3',
      },
    ],
  },
  section19: {
    accuracyDeclaration: true,
    backgroundCheckConsent: true,
    dataProcessingConsent: true,
    fullName: 'John Michael Doe',
    signatureDate: '2026-03-18',
    placeOfSigning: 'Mumbai',
  },
}

test.describe('applicant validation contract', () => {
  test('all mandatory sections accept valid payloads', () => {
    const mandatorySections = [1, 2, 3, 4, 6, 8, 10, 11, 13, 14, 16, 18, 19]

    for (const sectionNumber of mandatorySections) {
      const validation = validateSection(sectionNumber, validSections[`section${sectionNumber}`])
      expect(validation.isValid, `Expected section ${sectionNumber} valid payload to pass`).toBe(true)
      expect(validation.errors).toEqual([])
    }
  })

  test('mandatory section aggregator accepts a fully valid application payload', () => {
    const result = validateAllMandatorySections(validSections)
    expect(result.isValid).toBe(true)
    expect(result.invalidSections).toEqual([])
  })

  test('section 1 enforces conditional recommendation and advertisement fields', () => {
    const missingRecommendation = validateSection(1, {
      ...validSections.section1,
      professionalRecommendation: true,
      recommendedBy: '',
    })
    expect(missingRecommendation.errors).toContain('Recommender name is required when applying upon recommendation')

    const missingAdvertisementDetails = validateSection(1, {
      ...validSections.section1,
      mediaAdvertisement: true,
      mediaAdvertisementDetails: '',
    })
    expect(missingAdvertisementDetails.errors).toContain('Advertisement details are required when responding to media advertisement')
  })

  test('section 2 field validator rejects malformed email and short phone', () => {
    expect(validateFieldInSection(2, 'email', 'invalid-email')).toBe('Please enter a valid email address')
    expect(validateFieldInSection(2, 'phoneNumber', '12345')).toBe('Please enter a valid phone number')
  })

  test('sections 3 and 4 reject expiry dates before issue dates', () => {
    const invalidPassport = validateSection(3, {
      ...validSections.section3,
      dateOfIssue: '2026-01-01',
      dateOfExpiry: '2025-01-01',
    })
    expect(invalidPassport.errors).toContain('Expiry date must be after issue date')

    const invalidCdc = validateSection(4, {
      ...validSections.section4,
      dateOfIssue: '2026-01-01',
      dateOfExpiry: '2025-01-01',
    })
    expect(invalidCdc.errors).toContain('Expiry date must be after issue date')
  })

  test('section 6 requires at least one education entry', () => {
    const validation = validateSection(6, { education: [] })
    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('At least one education entry is required')
  })

  test('section 8 requires at least one certificate', () => {
    const validation = validateSection(8, { certificates: [] })
    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('At least one certificate is required')
  })

  test('section 10 requires at least one medical certificate', () => {
    const validation = validateSection(10, { medicalFitness: [] })
    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('At least one medical fitness certificate is required')
  })

  test('section 11 requires incident details only when signed off medical is true', () => {
    const validation = validateSection(11, {
      medicalHistory: {
        signedOffMedical: true,
        vesselName: '',
        dateOfOccurrence: '',
        description: '',
      },
    })
    expect(validation.errors).toContain('Vessel name is required')
    expect(validation.errors).toContain('Date of occurrence is required')
    expect(validation.errors).toContain('Description is required')
  })

  test('section 13 field validator rejects non-positive height and weight', () => {
    expect(validateFieldInSection(13, 'height', '0')).toBe('Please enter a valid height')
    expect(validateFieldInSection(13, 'weight', '-1')).toBe('Please enter a valid weight')
  })

  test('section 14 no longer requires auto-managed metadata fields', () => {
    const validation = validateSection(14, {
      courses: [
        {
          ...validSections.section14.courses[0],
          imoModelCourse: '',
          referenceRegulation: '',
        },
      ],
    })
    expect(validation.errors).toEqual([])
  })

  test('section 14 requires certificate-specific fields and date ordering', () => {
    const validation = validateSection(14, {
      courses: [
        {
          ...validSections.section14.courses[0],
          certificateNumber: '',
          dateOfExpiry: '2024-01-01',
        },
      ],
    })
    expect(validation.errors).toContain('Course 1: Certificate number is required')
    expect(validation.errors).toContain('Course 1: Expiry date must be after issue date')
  })

  test('section 16 requires the expanded sea service fields', () => {
    const validation = validateSection(16, {
      seaService: [
        {
          ...validSections.section16.seaService[0],
          teu: '',
          mainEngineMake: '',
          position: '',
          manning: '',
          totalMmDd: '',
          reasonForLeaving: '',
        },
      ],
    })
    expect(validation.errors).toContain('Sea Service 1: TEU is required')
    expect(validation.errors).toContain('Sea Service 1: Main engine make is required')
    expect(validation.errors).toContain('Sea Service 1: Position is required')
    expect(validation.errors).toContain('Sea Service 1: Manning is required')
    expect(validation.errors).toContain('Sea Service 1: Total mm/dd is required')
    expect(validation.errors).toContain('Sea Service 1: Reason for leaving is required')
  })

  test('section 18 requires two references', () => {
    const validation = validateSection(18, { references: [validSections.section18.references[0]] })
    expect(validation.isValid).toBe(false)
    expect(validation.errors).toContain('At least two professional references are required')
  })

  test('section 19 requires all declarations and signature fields', () => {
    const validation = validateSection(19, {
      accuracyDeclaration: false,
      backgroundCheckConsent: false,
      dataProcessingConsent: false,
      fullName: '',
      signatureDate: '',
      placeOfSigning: '',
    })
    expect(validation.errors).toContain('You must declare that all information is accurate')
    expect(validation.errors).toContain('Background check consent is required')
    expect(validation.errors).toContain('Data processing consent is required')
    expect(validation.errors).toContain('Full name for signature is required')
    expect(validation.errors).toContain('Signature date is required')
    expect(validation.errors).toContain('Place of signing is required')
  })
})
