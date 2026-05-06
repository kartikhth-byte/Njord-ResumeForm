const DAY_MS = 24 * 60 * 60 * 1000
const EXPIRING_SOON_DAYS = 30
const PASSPORT_MIN_VALIDITY_DAYS = 365
const COC_NEAR_EXPIRY_DAYS = 180
const SEA_SERVICE_GAP_DAYS = 180

const DECK_RANKS = new Set([
  'master',
  'chief_officer',
  'second_officer',
  'third_officer',
  'deck_cadet',
  'radio_officer',
  'master_mariner',
])

const ENGINE_RANKS = new Set([
  'chief_engineer',
  'second_engineer',
  'third_engineer',
  'fourth_engineer',
  'engine_cadet',
  'electrical_engineer',
  'electrical_officer',
  'electro_technical_officer',
  'asst_electrical_officer',
])

const DECK_RATING_RANKS = new Set([
  'bosun',
  'deck_fitter',
  'ab',
  'os',
  'gp',
])

const ENGINE_RATING_RANKS = new Set([
  'pumpman',
  'engine_fitter',
  'fitter',
  'motorman',
  'wiper',
  'oiler',
  'travel_fitter',
  'travel_wiper',
  'reefer_mechanic',
])

const TANKER_VESSEL_TYPES = new Set([
  'bitumen_tanker',
  'bunker_tanker',
  'chemical_tanker',
  'crude_oil_tanker',
  'lng_carrier',
  'lpg_carrier',
  'mr_tanker',
  'oil_tanker',
  'oil_chem_tanker',
  'product_tanker',
  'ulcc',
  'vlcc',
  'vlgc',
  'vlec',
  'legc',
])

const OIL_CHEM_VESSEL_TYPES = new Set([
  'bitumen_tanker',
  'bunker_tanker',
  'chemical_tanker',
  'crude_oil_tanker',
  'mr_tanker',
  'oil_tanker',
  'oil_chem_tanker',
  'product_tanker',
  'ulcc',
  'vlcc',
])

const GAS_VESSEL_TYPES = new Set([
  'lng_carrier',
  'lpg_carrier',
  'vlgc',
  'vlec',
  'legc',
])

const PASSENGER_VESSEL_TYPES = new Set([
  'cruise_ship',
  'passenger_ship',
  'passenger_cruise_vessel',
  'ropax_vessel',
  'roro_passenger',
])

function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

function diffInDays(date, baseline = new Date()) {
  if (!date) return null
  const base = new Date(baseline)
  base.setHours(0, 0, 0, 0)
  return Math.floor((date.getTime() - base.getTime()) / DAY_MS)
}

function formatDate(value) {
  const parsed = parseDate(value)
  if (!parsed) return 'Not provided'
  return parsed.toLocaleDateString('en-GB')
}

function formatDaysLabel(days) {
  if (days === null || days === undefined) return 'Unknown'
  if (days < 0) return `${Math.abs(days)} day(s) overdue`
  return `${days} day(s) remaining`
}

function buildStatusFromExpiry({
  label,
  value,
  required = true,
  expiringSoonDays = EXPIRING_SOON_DAYS,
  missingStatus = 'red',
}) {
  const expiryDate = parseDate(value)
  const daysRemaining = diffInDays(expiryDate)

  if (!expiryDate) {
    return {
      label,
      status: required ? missingStatus : 'amber',
      detail: required ? 'Missing expiry date or record' : 'Not recorded',
      expiryDate: null,
      daysRemaining: null,
    }
  }

  if (daysRemaining < 0) {
    return {
      label,
      status: 'red',
      detail: `Expired on ${formatDate(value)}`,
      expiryDate: value,
      daysRemaining,
    }
  }

  if (daysRemaining < expiringSoonDays) {
    return {
      label,
      status: 'amber',
      detail: `Expires on ${formatDate(value)} (${formatDaysLabel(daysRemaining)})`,
      expiryDate: value,
      daysRemaining,
    }
  }

  return {
    label,
    status: 'green',
    detail: `Valid until ${formatDate(value)} (${formatDaysLabel(daysRemaining)})`,
    expiryDate: value,
    daysRemaining,
  }
}

function pickLatestRecord(records, preferredDateKey = 'dateOfExpiry') {
  if (!Array.isArray(records)) return null

  return records
    .filter(Boolean)
    .sort((left, right) => {
      const rightDate = parseDate(right?.[preferredDateKey]) || parseDate(right?.dateOfIssue)
      const leftDate = parseDate(left?.[preferredDateKey]) || parseDate(left?.dateOfIssue)
      return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0)
    })[0] || null
}

function hasAnyVaccinationRecord(vaccinations) {
  if (!vaccinations || typeof vaccinations !== 'object') return false

  if (vaccinations.covidVaccinated) return true
  if (vaccinations.yellowFever?.received) return true

  return Object.entries(vaccinations).some(([key, value]) => {
    if (key === 'yellowFever') return false
    if (typeof value === 'boolean') return value
    return Boolean(value)
  })
}

function getRankCategory(rank) {
  if (DECK_RANKS.has(rank)) return 'deck'
  if (ENGINE_RANKS.has(rank)) return 'engine'
  if (DECK_RATING_RANKS.has(rank)) return 'deck_rating'
  if (ENGINE_RATING_RANKS.has(rank)) return 'engine_rating'
  return 'other'
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function recordText(record) {
  if (!record || typeof record !== 'object') return ''
  return Object.values(record)
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .toLowerCase()
}

function pickLatestMatchingRecord(records, matcher, preferredDateKey = 'dateOfExpiry') {
  if (!Array.isArray(records)) return null
  return pickLatestRecord(records.filter((record) => matcher(record)), preferredDateKey)
}

function buildRecordItem({
  label,
  record,
  value,
  expiringSoonDays = EXPIRING_SOON_DAYS,
  required = true,
  missingDetail = 'Record not found',
  sourceLabel,
}) {
  if (!record) {
    return {
      label,
      status: required ? 'red' : 'amber',
      detail: missingDetail,
      expiryDate: null,
      sourceName: null,
    }
  }

  const expiryStatus = buildStatusFromExpiry({
    label,
    value,
    expiringSoonDays,
    required,
    missingStatus: required ? 'red' : 'amber',
  })

  return {
    ...expiryStatus,
    sourceName: sourceLabel || null,
    detail: sourceLabel ? `${sourceLabel} • ${expiryStatus.detail}` : expiryStatus.detail,
  }
}

function buildCourseItem(courses, label, courseNames, options = {}) {
  const {
    required = true,
    expiringSoonDays = EXPIRING_SOON_DAYS,
    missingDetail = 'Course not recorded',
    namePatterns = [],
  } = options

  const normalizedPatterns = namePatterns.map(normalizeText)
  const latestCourse = pickLatestMatchingRecord(courses, (course) => {
    const courseName = course?.courseName || ''
    const normalizedCourseName = normalizeText(courseName)
    if (courseNames.includes(courseName)) return true
    return normalizedPatterns.some((pattern) => normalizedCourseName.includes(pattern))
  })
  if (!latestCourse) {
    return {
      label,
      status: required ? 'red' : 'amber',
      detail: missingDetail,
      sourceName: null,
      expiryDate: null,
    }
  }

  const status = buildStatusFromExpiry({
    label,
    value: latestCourse.dateOfExpiry,
    required,
    expiringSoonDays,
    missingStatus: required ? 'red' : 'amber',
  })

  return {
    ...status,
    sourceName: latestCourse.courseName,
    detail: `${latestCourse.courseName} • ${status.detail}`,
  }
}

function getRelevantVesselTypes(section1VesselType, seaService) {
  const vesselTypes = new Set()
  if (section1VesselType) vesselTypes.add(section1VesselType)

  if (Array.isArray(seaService)) {
    seaService.forEach((entry) => {
      const vesselType = entry?.vesselType
      if (vesselType) vesselTypes.add(vesselType)
    })
  }

  return vesselTypes
}

function hasVesselTypeMatch(vesselTypes, matcherSet) {
  return [...vesselTypes].some((vesselType) => matcherSet.has(vesselType))
}

function hasIgfIndicator(section1VesselType, seaService) {
  const relevantTypes = getRelevantVesselTypes(section1VesselType, seaService)
  if (hasVesselTypeMatch(relevantTypes, GAS_VESSEL_TYPES)) return true

  return Array.isArray(seaService) && seaService.some((entry) => {
    const engineDescriptor = normalizeText(entry?.mainEngine)
    return engineDescriptor.includes('lng') || engineDescriptor.includes('dual fuel')
  })
}

function vesselApplicabilityReasons(section1VesselType, seaService) {
  const relevantTypes = getRelevantVesselTypes(section1VesselType, seaService)
  const reasons = []

  if (hasVesselTypeMatch(relevantTypes, OIL_CHEM_VESSEL_TYPES)) {
    reasons.push(`oil/chemical tanker profile detected (${[...relevantTypes].filter((type) => OIL_CHEM_VESSEL_TYPES.has(type)).join(', ')})`)
  }

  if (hasVesselTypeMatch(relevantTypes, GAS_VESSEL_TYPES)) {
    reasons.push(`gas tanker profile detected (${[...relevantTypes].filter((type) => GAS_VESSEL_TYPES.has(type)).join(', ')})`)
  }

  if (hasVesselTypeMatch(relevantTypes, PASSENGER_VESSEL_TYPES)) {
    reasons.push(`passenger / ro-pax profile detected (${[...relevantTypes].filter((type) => PASSENGER_VESSEL_TYPES.has(type)).join(', ')})`)
  }

  if (hasIgfIndicator(section1VesselType, seaService)) {
    reasons.push('IGF / LNG-fuel indicator detected from vessel or engine history')
  }

  return reasons
}

function buildSeaServiceGapFlags(seaService) {
  if (!Array.isArray(seaService) || seaService.length < 2) return []

  const sorted = [...seaService]
    .filter((entry) => entry?.signOnDate || entry?.signOffDate)
    .sort((left, right) => {
      const rightSignOn = parseDate(right?.signOnDate)
      const leftSignOn = parseDate(left?.signOnDate)
      return (rightSignOn?.getTime() || 0) - (leftSignOn?.getTime() || 0)
    })

  const gaps = []

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const newer = sorted[index]
    const older = sorted[index + 1]
    const newerSignOn = parseDate(newer?.signOnDate)
    const olderSignOff = parseDate(older?.signOffDate)

    if (!newerSignOn || !olderSignOff) continue

    const gapDays = diffInDays(newerSignOn, olderSignOff)
    if (gapDays > SEA_SERVICE_GAP_DAYS) {
      gaps.push({
        status: 'red',
        title: 'Sea-service gap greater than 6 months',
        detail: `${gapDays} day(s) between ${older?.vesselName || 'previous contract'} sign-off (${formatDate(older?.signOffDate)}) and ${newer?.vesselName || 'next contract'} sign-on (${formatDate(newer?.signOnDate)}).`,
      })
    }
  }

  return gaps
}

function buildGroup(title, items) {
  const filteredItems = items.filter(Boolean)
  const counts = filteredItems.reduce((summary, item) => {
    summary[item.status] += 1
    return summary
  }, { red: 0, amber: 0, green: 0 })

  return {
    title,
    items: filteredItems,
    counts,
  }
}

export function buildApplicationCompliance(applicationData = {}) {
  const section1 = applicationData.section1 || {}
  const section3 = applicationData.section3 || {}
  const section4 = applicationData.section4 || {}
  const section5 = applicationData.section5 || {}
  const section8 = applicationData.section8 || {}
  const section9 = applicationData.section9 || {}
  const section10 = applicationData.section10 || {}
  const section14 = applicationData.section14 || {}
  const section15 = applicationData.section15 || {}
  const section16 = applicationData.section16 || {}

  const rank = section1.appliedForRank || ''
  const rankCategory = getRankCategory(rank)
  const courses = Array.isArray(section14.courses) ? section14.courses : []
  const medicalCertificates = Array.isArray(section10.medicalFitness) ? section10.medicalFitness : []
  const cocCertificates = Array.isArray(section8.certificates) ? section8.certificates : []
  const gmdssCertificates = Array.isArray(section9.gmdss) ? section9.gmdss : []
  const endorsements = Array.isArray(section15.endorsements) ? section15.endorsements : []
  const visas = Array.isArray(section5.visas) ? section5.visas : []
  const seaService = Array.isArray(section16.seaService) ? section16.seaService : []

  const latestMedical = pickLatestRecord(medicalCertificates)
  const latestCoc = pickLatestRecord(cocCertificates)
  const latestGmdss = pickLatestRecord(gmdssCertificates)
  const latestEndorsement = pickLatestRecord(endorsements)
  const latestVisa = pickLatestRecord(visas)
  const relevantVesselTypes = getRelevantVesselTypes(section1.vesselType, seaService)
  const tankerProfile = hasVesselTypeMatch(relevantVesselTypes, TANKER_VESSEL_TYPES)
  const oilChemProfile = hasVesselTypeMatch(relevantVesselTypes, OIL_CHEM_VESSEL_TYPES)
  const gasProfile = hasVesselTypeMatch(relevantVesselTypes, GAS_VESSEL_TYPES)
  const passengerProfile = hasVesselTypeMatch(relevantVesselTypes, PASSENGER_VESSEL_TYPES)
  const igfProfile = hasIgfIndicator(section1.vesselType, seaService)

  const passportItem = buildStatusFromExpiry({
    label: 'Passport',
    value: section3.dateOfExpiry,
    expiringSoonDays: PASSPORT_MIN_VALIDITY_DAYS,
  })

  passportItem.detail = passportItem.expiryDate
    ? `Passport expires on ${formatDate(section3.dateOfExpiry)} (${formatDaysLabel(passportItem.daysRemaining)})`
    : passportItem.detail

  const coreDocumentsGroup = buildGroup('Core documents', [
    passportItem,
    buildStatusFromExpiry({
      label: 'CDC / Seaman Book',
      value: section4.dateOfExpiry,
    }),
    latestMedical
      ? {
          ...buildStatusFromExpiry({
            label: 'Medical fitness certificate',
            value: latestMedical.dateOfExpiry,
          }),
          detail: `${latestMedical.type || 'Medical certificate'} • ${buildStatusFromExpiry({
            label: 'Medical fitness certificate',
            value: latestMedical.dateOfExpiry,
          }).detail}`,
        }
      : {
          label: 'Medical fitness certificate',
          status: 'red',
          detail: 'No medical fitness certificate recorded',
          expiryDate: null,
        },
    latestCoc
      ? {
          ...buildStatusFromExpiry({
            label: 'Certificate of Competency (CoC)',
            value: latestCoc.dateOfExpiry || latestCoc.dateRevalidationExpiry,
            expiringSoonDays: COC_NEAR_EXPIRY_DAYS,
          }),
          detail: `${latestCoc.grade || 'CoC'} • ${buildStatusFromExpiry({
            label: 'Certificate of Competency (CoC)',
            value: latestCoc.dateOfExpiry || latestCoc.dateRevalidationExpiry,
            expiringSoonDays: COC_NEAR_EXPIRY_DAYS,
          }).detail}`,
        }
      : {
          label: 'Certificate of Competency (CoC)',
          status: 'red',
          detail: 'No CoC record found',
          expiryDate: null,
        },
  ])

  const trainingGroup = buildGroup('Core training', [
    buildCourseItem(courses, 'Basic Training', ['Basic Training'], {
      missingDetail: 'Basic Training not recorded',
    }),
    buildCourseItem(courses, 'Personal Survival Techniques', [
      'Personal Survival Techniques - BASIC TRAINING',
      'Basic Training',
    ]),
    buildCourseItem(courses, 'Basic Fire Fighting', [
      'Basic Fire Fighting - BASIC TRAINING',
      'Basic Training',
    ]),
    buildCourseItem(courses, 'Elementary First Aid', [
      'Elementary First Aid - BASIC TRAINING',
      'Basic Training',
    ]),
    buildCourseItem(courses, 'PSSR', [
      'Personal Safety & Social Responsibilities (Human Relationship) - BASIC TRAINING',
      'Basic Training',
    ]),
    buildCourseItem(courses, 'Security training', [
      'Vessel security training course',
    ]),
  ])

  const rankSpecificItems = []

  if (rankCategory === 'deck') {
    rankSpecificItems.push(
      buildCourseItem(courses, 'Advanced Fire Fighting', ['Advanced Fire Fighting']),
      buildCourseItem(courses, 'Medical First Aid / Medical Care', ['Medical First Aid', 'Medical Care']),
      buildCourseItem(courses, 'ECDIS', ['ECDIS']),
      buildCourseItem(courses, 'ARPA / Radar', ['ARPA / NCC', 'Radar Simulator']),
      latestGmdss
        ? {
            ...buildStatusFromExpiry({
              label: 'GMDSS',
              value: latestGmdss.dateOfExpiry,
            }),
            detail: `${latestGmdss.number || 'GMDSS'} • ${buildStatusFromExpiry({
              label: 'GMDSS',
              value: latestGmdss.dateOfExpiry,
            }).detail}`,
          }
        : {
            label: 'GMDSS',
            status: 'red',
            detail: 'No GMDSS certificate recorded',
            expiryDate: null,
          }
    )
  }

  if (rankCategory === 'engine') {
    rankSpecificItems.push(
      buildCourseItem(courses, 'Advanced Fire Fighting', ['Advanced Fire Fighting']),
      buildCourseItem(courses, 'High Voltage Training', ['High Voltage Training'])
    )
  }

  if (rankCategory === 'deck_rating') {
    const watchkeepingRecord = pickLatestMatchingRecord(
      [...cocCertificates, ...endorsements],
      (record) => {
        const text = recordText(record)
        return text.includes('watchkeeping') || text.includes('ii/4') || text.includes('nwko')
      },
      'dateOfExpiry'
    )
    const ableSeafarerRecord = pickLatestMatchingRecord(
      [...cocCertificates, ...endorsements],
      (record) => {
        const text = recordText(record)
        return text.includes('able seafarer') || text.includes('ii/5') || text.includes('able seaman')
      },
      'dateOfExpiry'
    )

    rankSpecificItems.push(
      buildRecordItem({
        label: 'Watchkeeping certificate (deck ratings)',
        record: watchkeepingRecord,
        value: watchkeepingRecord?.dateOfExpiry,
        missingDetail: 'No deck watchkeeping certificate found (II/4 / NWKO evidence not detected)',
        sourceLabel: watchkeepingRecord?.grade || watchkeepingRecord?.endorsementType || watchkeepingRecord?.certificateNumber,
      }),
      buildRecordItem({
        label: 'Able Seafarer Deck',
        record: ableSeafarerRecord,
        value: ableSeafarerRecord?.dateOfExpiry,
        missingDetail: 'No Able Seafarer Deck evidence found (II/5 evidence not detected)',
        sourceLabel: ableSeafarerRecord?.grade || ableSeafarerRecord?.endorsementType || ableSeafarerRecord?.certificateNumber,
      })
    )
  }

  if (rankCategory === 'engine_rating') {
    const watchkeepingRecord = pickLatestMatchingRecord(
      [...cocCertificates, ...endorsements],
      (record) => {
        const text = recordText(record)
        return text.includes('watchkeeping') || text.includes('iii/4') || text.includes('nwko')
      },
      'dateOfExpiry'
    )
    const ableSeafarerRecord = pickLatestMatchingRecord(
      [...cocCertificates, ...endorsements],
      (record) => {
        const text = recordText(record)
        return text.includes('able seafarer') || text.includes('iii/5')
      },
      'dateOfExpiry'
    )

    rankSpecificItems.push(
      buildRecordItem({
        label: 'Watchkeeping certificate (engine ratings)',
        record: watchkeepingRecord,
        value: watchkeepingRecord?.dateOfExpiry,
        missingDetail: 'No engine watchkeeping certificate found (III/4 evidence not detected)',
        sourceLabel: watchkeepingRecord?.grade || watchkeepingRecord?.endorsementType || watchkeepingRecord?.certificateNumber,
      }),
      buildRecordItem({
        label: 'Able Seafarer Engine',
        record: ableSeafarerRecord,
        value: ableSeafarerRecord?.dateOfExpiry,
        missingDetail: 'No Able Seafarer Engine evidence found (III/5 evidence not detected)',
        sourceLabel: ableSeafarerRecord?.grade || ableSeafarerRecord?.endorsementType || ableSeafarerRecord?.certificateNumber,
      })
    )
  }

  const warningsGroup = buildGroup('Warning review items', [
    latestEndorsement
      ? {
          ...buildStatusFromExpiry({
            label: 'Latest flag-state endorsement',
            value: latestEndorsement.dateOfExpiry,
            required: false,
          }),
          detail: `${latestEndorsement.flagState || 'Flag state'} • ${latestEndorsement.endorsementType || 'Endorsement'} • ${buildStatusFromExpiry({
            label: 'Latest flag-state endorsement',
            value: latestEndorsement.dateOfExpiry,
            required: false,
          }).detail}`,
        }
      : {
          label: 'Latest flag-state endorsement',
          status: 'amber',
          detail: 'No flag-state endorsement recorded',
          expiryDate: null,
        },
    latestVisa
      ? {
          ...buildStatusFromExpiry({
            label: 'Latest visa record',
            value: latestVisa.dateOfExpiry,
            required: false,
          }),
          detail: `${latestVisa.type || 'Visa'} • ${buildStatusFromExpiry({
            label: 'Latest visa record',
            value: latestVisa.dateOfExpiry,
            required: false,
          }).detail}`,
        }
      : {
          label: 'Latest visa record',
          status: 'amber',
          detail: 'No visa recorded. Review only if customer / route requires it.',
          expiryDate: null,
        },
    section10.vaccinations?.yellowFever?.received
      ? (() => {
          const yellowFever = section10.vaccinations.yellowFever
          if (yellowFever.lifetimeValidity) {
            return {
              label: 'Yellow fever vaccination',
              status: 'green',
              detail: 'Marked as lifetime valid',
              expiryDate: null,
            }
          }

          return buildStatusFromExpiry({
            label: 'Yellow fever vaccination',
            value: yellowFever.dateOfExpiry,
            required: false,
          })
        })()
      : {
          label: 'Vaccination records',
          status: hasAnyVaccinationRecord(section10.vaccinations) ? 'green' : 'amber',
          detail: hasAnyVaccinationRecord(section10.vaccinations)
            ? 'Vaccination information is present. Review route / port requirements manually.'
            : 'No vaccination records recorded. Review route / port requirements manually.',
          expiryDate: null,
        },
  ])

  const rankSpecificGroup = rankSpecificItems.length > 0
    ? buildGroup('Rank-specific checks', rankSpecificItems)
    : null

  const specialVesselItems = []

  if (oilChemProfile) {
    specialVesselItems.push(
      buildCourseItem(courses, 'Oil / Chemical tanker training (V/1-1)', [], {
        namePatterns: [
          'oil tanker',
          'chemical tanker',
          'tanker familiarization',
          'haz mat',
        ],
        missingDetail: 'No oil / chemical tanker training record found for the current vessel profile',
      })
    )
  }

  if (gasProfile) {
    specialVesselItems.push(
      buildCourseItem(courses, 'Gas tanker training (V/1-2)', [], {
        namePatterns: [
          'gas tanker',
          'liquefied gas tanker',
          'lng',
          'lpg',
        ],
        missingDetail: 'No gas tanker training record found for the current vessel profile',
      })
    )
  }

  if (passengerProfile) {
    specialVesselItems.push(
      buildCourseItem(courses, 'Passenger ship training (V/2)', [], {
        namePatterns: [
          'passenger ship',
          'ro-ro passenger',
          'crowd management',
          'crisis management',
          'human behavior',
        ],
        missingDetail: 'No passenger ship training record found for the current vessel profile',
      })
    )
  }

  if (igfProfile) {
    specialVesselItems.push(
      buildCourseItem(courses, 'IGF Code training (V/3)', [], {
        namePatterns: [
          'igf',
        ],
        missingDetail: 'No IGF Code training record found for the current vessel / engine profile',
      })
    )
  }

  const specialVesselGroup = specialVesselItems.length > 0
    ? buildGroup('Special-vessel applicability checks', specialVesselItems)
    : null

  const redFlags = [
    ...buildSeaServiceGapFlags(seaService),
    ...cocCertificates
      .filter((certificate) => {
        const expiryDate = parseDate(certificate?.dateOfExpiry || certificate?.dateRevalidationExpiry)
        const daysRemaining = diffInDays(expiryDate)
        return daysRemaining !== null && daysRemaining >= 0 && daysRemaining < COC_NEAR_EXPIRY_DAYS
      })
      .map((certificate) => ({
        status: 'amber',
        title: 'CoC near expiry',
        detail: `${certificate.grade || 'CoC'} expires on ${formatDate(certificate.dateOfExpiry || certificate.dateRevalidationExpiry)}.`,
      })),
  ]

  const groups = [
    coreDocumentsGroup,
    trainingGroup,
    rankSpecificGroup,
    specialVesselGroup,
    warningsGroup,
  ].filter(Boolean)

  const summary = groups.reduce((totals, group) => {
    totals.red += group.counts.red
    totals.amber += group.counts.amber
    totals.green += group.counts.green
    return totals
  }, { red: 0, amber: 0, green: 0 })

  const overallStatus = summary.red > 0 ? 'red' : summary.amber > 0 ? 'amber' : 'green'

  return {
    overallStatus,
    summary,
    groups,
    redFlags,
    metadata: {
      rankCategory,
      appliedRank: rank,
      vesselType: section1.vesselType || '',
      relevantVesselTypes: [...relevantVesselTypes],
      vesselApplicabilityReasons: vesselApplicabilityReasons(section1.vesselType, seaService),
      tankerProfile,
      gasProfile,
      passengerProfile,
      igfProfile,
    },
  }
}
