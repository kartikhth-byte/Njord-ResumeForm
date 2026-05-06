import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import ExcelJS from 'npm:exceljs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'npm:fflate'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const TEMPLATE_BUCKET = 'worksheet-templates'
const PROTECTED_SHEET_ALIASES: Record<string, string> = {
  History: 'History_Njord_Internal',
}

const MAIN_SHEET_NAME = 'Main'
const HISTORY_SHEET_NAME = 'History'
const END_SHEET_NAME = 'End'

const END_VESSEL_TABLE_ROWS = [
  ['3', 'Master - C/E'],
  ['4', 'C/O - 2/E'],
  ['5', '2/O - 3/E'],
  ['6', '3/O - 4/E'],
  ['7', 'E/O'],
]
const END_ENGINE_TABLE_ROWS = [
  ['11', 'C/E'],
  ['12', '2/E'],
  ['13', '3/E'],
  ['14', '4/E'],
  ['15', 'E/O'],
]
const END_VESSEL_COLUMNS = { Container: 'B', Tanker: 'C', 'Bulk carrier': 'D', Roro: 'E' }
const END_VESSEL_OTHER_LABEL_COLUMN = 'F'
const END_VESSEL_OTHER_VALUE_COLUMN = 'G'
const END_ENGINE_COLUMNS = {
  'Sulzer RTA': 'B',
  'Sulzer RND': 'C',
  'B & W': 'D',
  MAN: 'E',
  'SEMT Pielstick': 'F',
  'Steam Turbine': 'G',
  Others: 'H',
}
const FLAG_STATE_DOCUMENT_ROWS = [
  ['122', 'Malta', "Seafarer's Book"],
  ['123', 'Malta', 'Endorsement of the GMDSS'],
  ['124', 'Malta', 'Endorsement of the CoC'],
  ['126', 'Cyprus', "Seafarer's ID and Sea Service Record Book"],
  ['127', 'Cyprus', 'Cert. Of Recognition of the National CoC'],
  ['129', 'Bahamas', 'Endorsement of the CoC'],
  ['130', 'Bahamas', 'Endorsement of the GMDSS'],
  ['131', 'Bahamas', "Seafarer's Identification and Record Book"],
  ['133', 'United Kingdom', 'Endorsement of the CoC (UK CeC)'],
  ['134', 'United Kingdom', 'Endorsement of the GMDSS'],
  ['135', 'United Kingdom', "Seafarer's Identification and Record Book"],
  ['137', 'Panama', 'Endorsement of the CoC'],
  ['138', 'Panama', 'Endorsement of the GMDSS GOC'],
  ['139', 'Panama', "Seafarer's Identification and Record Book"],
]
const MAIN_MANAGED_CELLS = [
  'C16','C17','C18','E20','E21','F23','A25',
  'C26','F26','G26','C27','F27','B28','F28','H28',
  'A32','C32','D32','E32','G32',
  'B49','B50','F50','B51','C52','C53','B54','G54',
  'B57','F57','B58','C58','D58','F58','C59','G59',
  'A63','B63','D63','E63','G63',
]
const END_REFERENCE_LEFT_CELLS = [
  'H19','C24','C25','C26','C27','C28',
  'C31','C32','C33','C34','C35',
  'C36','C37','C38','C39','C40','A45',
]

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS', exposeHeaders: 'Content-Disposition' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  return json(
    {
      error: 'Worksheet generation has moved to the hosted worksheet service. Configure WORKSHEET_SERVICE_URL and use that endpoint instead.',
    },
    501
  )
})

async function loadWorkbookFromTemplate(supabase: ReturnType<typeof createAdminSupabaseClient>, template: Record<string, unknown>) {
  const templatePath = template.storage_path as string
  const sourceExtension = String(template.source_extension || '').toLowerCase()
  if (sourceExtension !== 'xlsx') {
    throw new Error('Upload a normalized .xlsx worksheet template before generating customer worksheets')
  }
  const { data: templateFile, error: downloadError } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .download(templatePath)

  if (downloadError || !templateFile) {
    throw downloadError || new Error('Failed to download worksheet template')
  }

  const xlsxBuffer = new Uint8Array(await templateFile.arrayBuffer())
  const { buffer, sheetAliases } = aliasProtectedSheetNames(xlsxBuffer)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return { workbook, sheetAliases }
}

async function loadWorksheetMappings(supabase: ReturnType<typeof createAdminSupabaseClient>, customerId: string, customerSlug: string) {
  const { data, error } = await supabase
    .from('worksheet_mappings')
    .select('*')
    .eq('customer_id', customerId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw error
  }

  if (data && data.length > 0) {
    return data
  }

  return []
}

function applyMappingsToWorkbook(workbook: ExcelJS.Workbook, payload: Record<string, unknown>, mappings: Array<Record<string, unknown>>) {
  for (const mappingRow of mappings) {
    const sheetName = String(mappingRow.sheet_name || 'Main')
    const cellRef = String(mappingRow.cell_ref || '')
    if (!cellRef) continue

    const worksheet = workbook.getWorksheet(sheetName)
    if (!worksheet) continue

    const value = transformValue(
      resolveMappingValue(payload, String(mappingRow.source_path || ''), String(mappingRow.field_key || '')),
      String(mappingRow.transform || 'text'),
      String(mappingRow.field_key || '')
    )

    const cell = worksheet.getCell(cellRef)
    cell.value = value
    cell.alignment = {
      ...cell.alignment,
      wrapText: false,
    }
  }
}

async function applySharedWorksheetWorkbook(
  workbook: ExcelJS.Workbook,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  sheetAliases: Record<string, string>
) {
  const main = workbook.getWorksheet(resolveWorksheetName(MAIN_SHEET_NAME, sheetAliases))
  if (!main) throw new Error(`Sheet ${MAIN_SHEET_NAME} not found in template`)

  ensureMerges(main, [
    'C36:D36','C37:D37','C38:D38','C39:D39','C40:D40','C41:D41',
    'E36:F36','E37:F37','E38:F38','E39:F39','E40:F40','E41:F41',
    'G36:H36','G37:H37','G38:H38','G39:H39','G40:H40','G41:H41',
    'A45:B45','A46:B46','E45:H45','E46:H46',
    'B63:C63','E63:F63','G63:H63',
    'B76:D76','B77:D77','E76:H76','E77:H77',
    'E81:F81','E82:F82','G81:H81','G82:H82',
    ...FLAG_STATE_DOCUMENT_ROWS.map(([row]) => `F${row}:G${row}`),
  ])
  clearMainWorksheetOutputs(main)

  writeCell(main, 'C16', upper(getByPath(payload, 'section1.appliedForRank')))
  writeCell(main, 'C17', upper(getByPath(payload, 'section1.vesselType')))
  writeCell(main, 'C18', formatDate(getByPath(payload, 'section1.availableFrom')))
  writeCell(main, 'E20', yesNo(getByPath(payload, 'section1.mediaAdvertisement')))
  writeCell(main, 'E21', normalizeText(getByPath(payload, 'section1.mediaAdvertisementDetails')))
  writeCell(main, 'F23', yesNo(getByPath(payload, 'section1.professionalRecommendation')))
  writeCell(main, 'A25', normalizeText(getByPath(payload, 'section1.recommendedBy')))

  writeCell(main, 'C26', upper(getByPath(payload, 'section2.surname')))
  writeCell(main, 'F26', upper(getByPath(payload, 'section2.firstName')))
  writeCell(main, 'G26', upper(getByPath(payload, 'section2.middleName')))
  writeCell(main, 'C27', upper(getByPath(payload, 'section2.otherNames')))
  writeCell(main, 'F27', upper(getByPath(payload, 'section2.nationality')))
  writeCell(main, 'B28', upper(getByPath(payload, 'section2.placeOfBirth')))
  writeCell(main, 'F28', formatAge(getByPath(payload, 'section2.dateOfBirth')))
  writeCell(main, 'H28', upper(getByPath(payload, 'section2.gender')))

  writeCell(main, 'A32', normalizeText(getByPath(payload, 'section3.passportNumber')))
  writeCell(main, 'C32', upper(getByPath(payload, 'section3.placeOfIssue')))
  writeCell(main, 'D32', excelDate(getByPath(payload, 'section3.dateOfIssue')))
  writeCell(main, 'E32', formatDate(getByPath(payload, 'section3.dateOfExpiry')))
  writeCell(main, 'G32', upper(getByPath(payload, 'section3.issuingAuthority')))

  writeCell(main, 'B49', upper(concatAddress([getByPath(payload, 'section2.address'), getByPath(payload, 'section2.city'), getByPath(payload, 'section2.state')])))
  writeCell(main, 'B50', numeric(getByPath(payload, 'section2.postalCode')))
  writeCell(main, 'F50', upper(getByPath(payload, 'section2.country')))
  writeCell(main, 'B51', normalizeText(getByPath(payload, 'section2.email')))
  writeCell(main, 'C52', numeric(getByPath(payload, 'section2.homeTelephoneNumber')))
  writeCell(main, 'C53', concatNumeric([getByPath(payload, 'section2.phoneCountryCode'), getByPath(payload, 'section2.phoneNumber')]))
  writeCell(main, 'B54', upper(getByPath(payload, 'section2.domesticAirport')))
  writeCell(main, 'G54', upper(getByPath(payload, 'section2.internationalAirport')))

  writeCell(main, 'B57', upper(getByPath(payload, 'section2.emergencyContact.name')))
  writeCell(main, 'F57', upper(getByPath(payload, 'section2.emergencyContact.relationship')))
  const emergencyAddress = normalizeText(getByPath(payload, 'section2.emergencyContact.address'))
  writeCell(main, 'B58', upper(splitByComma(emergencyAddress, 0)))
  writeCell(main, 'C58', upper(splitByComma(emergencyAddress, 1)))
  writeCell(main, 'D58', upper(splitByComma(emergencyAddress, 2)))
  writeCell(main, 'F58', upper(splitByComma(emergencyAddress, 3)))
  writeCell(main, 'C59', numeric(getByPath(payload, 'section2.emergencyContact.phone')))
  writeCell(main, 'G59', numeric(getByPath(payload, 'section2.emergencyContact.mobile')))

  writeCell(main, 'A63', normalizeText(getByPath(payload, 'section4.cdcNumber')))
  writeCell(main, 'B63', upper(getByPath(payload, 'section4.placeOfIssue')))
  writeCell(main, 'D63', formatDate(getByPath(payload, 'section4.dateOfIssue')))
  writeCell(main, 'E63', formatDate(getByPath(payload, 'section4.dateOfExpiry')))
  writeCell(main, 'G63', upper(getByPath(payload, 'section4.issuingAuthority')))

  populateVisaRows(main, payload)
  populateEducationRows(main, payload)
  populateCocRows(main, payload)
  populateGmdssRow(main, payload)
  populateMedicalRows(main, payload)
  populateLanguageRows(main, payload)
  populateMarineCourseRows(main, payload)
  populateFlagDocuments(main, payload)

  const history = workbook.getWorksheet(resolveWorksheetName(HISTORY_SHEET_NAME, sheetAliases))
  if (history) {
    clearWorksheetRect(history, 'A4:P20')
    populateHistorySheet(history, payload)
  }

  const end = workbook.getWorksheet(resolveWorksheetName(END_SHEET_NAME, sheetAliases))
  if (end) {
    clearEndWorksheetOutputs(end)
    populateEndSummary(end, payload)
    populateEndReferences(end, payload)
  }

  await tryInsertPhoto(workbook, main, payload, supabase)
}

function populateVisaRows(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const rows = [
    ['36', 'C1/D (USA)'],
    ['37', 'C1 (USA)'],
    ['38', 'D (USA)'],
    ['39', 'Australia Entry visa'],
    ['40', 'MCV (Australia)'],
    ['41', 'Schengen'],
  ]
  const visas = asArray(getByPath(payload, 'section5.visas'))
  for (const [row, visaType] of rows) {
    const visa = visas.find((entry) => canonicalizeVisaType(entry?.type) === canonicalizeVisaType(visaType))
    writeCell(worksheet, `B${row}`, normalizeText(visa?.number), 'center')
    writeCell(worksheet, `C${row}`, upper(visa?.placeOfIssue), 'center')
    writeCell(worksheet, `E${row}`, excelDate(visa?.dateOfIssue), 'center')
    writeCell(worksheet, `G${row}`, excelDate(visa?.dateOfExpiry), 'center')
  }
}

function populateEducationRows(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const education = asArray(getByPath(payload, 'section6.education')).slice(-2)
  ;[['45', education[0]], ['46', education[1]]].forEach(([row, entry]) => {
    writeCell(worksheet, `A${row}`, normalizeText(entry?.institution))
    writeCell(worksheet, `C${row}`, formatYear(entry?.from))
    writeCell(worksheet, `D${row}`, formatYear(entry?.to))
    writeCell(worksheet, `E${row}`, normalizeText(entry?.qualification))
  })
}

function populateCocRows(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const certificates = asArray(getByPath(payload, 'section8.certificates')).slice(-2)
  ;[['67', certificates[0]], ['68', certificates[1]]].forEach(([row, entry]) => {
    writeCell(worksheet, `A${row}`, normalizeText(entry?.grade))
    writeCell(worksheet, `B${row}`, upper(entry?.issuingAuthority))
    writeCell(worksheet, `C${row}`, normalizeText(entry?.certificateNumber))
    writeCell(worksheet, `D${row}`, excelDate(entry?.dateOfIssue))
    writeCell(worksheet, `E${row}`, formatDate(entry?.dateOfExpiry))
    writeCell(worksheet, `F${row}`, upper(entry?.placeOfIssue))
    writeCell(worksheet, `G${row}`, formatDate(entry?.dateRevalidated))
    writeCell(worksheet, `H${row}`, formatDate(entry?.dateRevalidationExpiry))
  })
}

function populateGmdssRow(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const gmdss = asArray(getByPath(payload, 'section9.gmdss'))
  const entry = gmdss.at(-1)
  writeCell(worksheet, 'A72', upper(entry?.issuingAuthority), 'center')
  writeCell(worksheet, 'C72', normalizeText(entry?.number), 'center')
  writeCell(worksheet, 'D72', formatDate(entry?.dateOfIssue), 'center')
  writeCell(worksheet, 'E72', formatDate(entry?.dateOfExpiry), 'center')
  writeCell(worksheet, 'G72', upper(entry?.placeOfIssue), 'center')
}

function populateMedicalRows(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const medical = asArray(getByPath(payload, 'section10.medicalFitness')).slice(-2)
  ;[['76', medical[0]], ['77', medical[1]]].forEach(([row, entry]) => {
    writeCell(worksheet, `A${row}`, normalizeText(entry?.type), 'center')
    writeCell(worksheet, `B${row}`, formatDate(entry?.dateOfIssue), 'center')
    writeCell(worksheet, `E${row}`, formatDate(entry?.dateOfExpiry), 'center')
  })
}

function populateLanguageRows(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const languages = asArray(getByPath(payload, 'section12.languages')).slice(-2)
  ;[['81', languages[0]], ['82', languages[1]]].forEach(([row, entry]) => {
    writeCell(worksheet, `A${row}`, upper(entry?.language))
    const level = normalizeLanguageLevel(entry?.level)
    writeCell(worksheet, `D${row}`, level === 'beginner' ? '✓' : '', 'center')
    writeCell(worksheet, `E${row}`, level === 'intermediate' ? '✓' : '', 'center')
    writeCell(worksheet, `G${row}`, level === 'advanced' ? '✓' : '', 'center')
  })
}

function populateMarineCourseRows(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const courseRows = [
    ['86', 'Basic Training'],
    ['87', 'Personal Survival Techniques - BASIC TRAINING'],
    ['88', 'Basic Fire Fighting - BASIC TRAINING'],
    ['89', 'Elementary First Aid - BASIC TRAINING'],
    ['90', 'Personal Safety & Social Responsibilities (Human Relationship) - BASIC TRAINING'],
    ['91', 'Proficiency in survival craft & Rescue Boats'],
    ['92', 'Advanced Fire Fighting'],
    ['93', 'Medical First Aid'],
    ['94', 'Medical Care'],
    ['95', 'ROP'],
    ['96', 'ARPA/NCC'],
    ['97', 'Radar Simulator'],
    ['98', 'ECDIS'],
    ['99', 'HAZ MAT'],
    ['100', 'Ship simulator bridge teamwork'],
    ['101', 'BTM/ETM'],
    ['102', 'SSO'],
    ['103', 'BASSnet'],
    ['104', 'Ship Handling'],
    ['105', 'Bridge resource management'],
    ['106', 'Loading Software'],
    ['107', 'Simulator'],
    ['108', 'Indos Number'],
    ['109', 'Upgradation Course'],
    ['110', 'Revalidation Certificate'],
    ['111', 'High Voltage'],
    ['112', 'Reefer Training'],
    ['113', "Engine Maker's"],
    ['114', 'Crane Training'],
    ['115', 'Vessel Security Certificate'],
    ['116', 'Ship Safety Officer'],
    ['117', 'ISF Marlins English test'],
  ]
  const courses = asArray(getByPath(payload, 'section14.courses'))
  for (const [row, courseName] of courseRows) {
    const entry = [...courses].reverse().find((course) => canonicalizeMarineCourseName(course?.courseName) === canonicalizeMarineCourseName(courseName))
    writeCell(worksheet, `F${row}`, normalizeText(entry?.certificateNumber), 'center')
    writeCell(worksheet, `G${row}`, formatDate(entry?.dateOfIssue), 'center')
    writeCell(worksheet, `H${row}`, formatDate(entry?.dateOfExpiry), 'center')
  }
}

function populateFlagDocuments(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const endorsements = asArray(getByPath(payload, 'section15.endorsements'))
  for (const [row, flagState, endorsementType] of FLAG_STATE_DOCUMENT_ROWS) {
    const entry = [...endorsements].reverse().find((endorsement) =>
      canonicalizeFlagStateName(endorsement?.flagState) === canonicalizeFlagStateName(flagState) &&
      canonicalizeFlagStateEndorsementType(endorsement?.flagState, endorsement?.endorsementType) === canonicalizeFlagStateEndorsementType(flagState, endorsementType)
    )
    writeCell(worksheet, `C${row}`, normalizeText(entry?.rankEndorsed), 'center')
    writeCell(worksheet, `D${row}`, normalizeText(entry?.endorsementNumber), 'center')
    writeCell(worksheet, `E${row}`, upper(entry?.placeOfIssue), 'center')
    writeCell(worksheet, `F${row}`, formatDate(entry?.dateOfIssue), 'center')
    writeCell(worksheet, `H${row}`, formatDate(entry?.dateOfExpiry), 'center')
  }
}

function populateHistorySheet(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const seaService = getHistorySeaServiceRows(payload)
  seaService.forEach((entry, index) => {
    const row = 4 + index
    writeCell(worksheet, `A${row}`, upper(entry?.vesselName), 'center')
    writeCell(worksheet, `B${row}`, upper(entry?.company || entry?.companyName), 'center')
    writeCell(worksheet, `C${row}`, upper(entry?.manning), 'center')
    writeCell(worksheet, `D${row}`, upper(entry?.tradingArea || entry?.tradeRoute), 'center')
    writeCell(worksheet, `E${row}`, upper(entry?.vesselType), 'center')
    writeCell(worksheet, `F${row}`, upper(entry?.flag), 'center')
    writeCell(worksheet, `G${row}`, numeric(entry?.teu || entry?.dwt), 'center')
    writeCell(worksheet, `H${row}`, formatYear(entry?.yearBuilt), 'center')
    writeCell(worksheet, `I${row}`, upper(entry?.mainEngineMake), 'center')
    writeCell(worksheet, `J${row}`, upper(entry?.mainEngine), 'center')
    writeCell(worksheet, `K${row}`, numeric(entry?.engineKw), 'center')
    writeCell(worksheet, `L${row}`, upper(entry?.rankHeld || entry?.position), 'center')
    writeCell(worksheet, `M${row}`, excelDate(entry?.signOnDate), 'center')
    writeCell(worksheet, `N${row}`, formatDate(entry?.signOffDate), 'center')
    writeCell(worksheet, `O${row}`, formatMmDd(entry?.signOnDate, entry?.signOffDate), 'center')
    writeCell(worksheet, `P${row}`, upper(entry?.reasonForLeaving), 'center')
  })
}

function populateEndSummary(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  const seaService = getHistorySeaServiceRows(payload)
  const vesselTable = buildVesselExperienceTable(seaService)
  const engineTable = buildEngineExperienceTable(seaService)

  END_VESSEL_TABLE_ROWS.forEach(([row, bucket]) => {
    const rowData = vesselTable[bucket] || {}
    Object.entries(END_VESSEL_COLUMNS).forEach(([vesselBucket, column]) => {
      writeCell(worksheet, `${column}${row}`, formatYearMonthDuration(rowData[vesselBucket] || 0), 'center')
    })
    const latestOther = rowData.latest_other
    writeCell(worksheet, `${END_VESSEL_OTHER_LABEL_COLUMN}${row}`, latestOther?.label || '', 'center')
    writeCell(worksheet, `${END_VESSEL_OTHER_VALUE_COLUMN}${row}`, latestOther ? formatYearMonthDuration(latestOther.days) : '', 'center')
  })

  Object.entries(END_VESSEL_COLUMNS).forEach(([vesselBucket, column]) => {
    const total = END_VESSEL_TABLE_ROWS.reduce((sum, [, bucket]) => sum + (vesselTable[bucket]?.[vesselBucket] || 0), 0)
    writeCell(worksheet, `${column}8`, formatYearMonthDuration(total), 'center')
  })
  const totalOther = END_VESSEL_TABLE_ROWS.reduce((sum, [, bucket]) => sum + (vesselTable[bucket]?.latest_other?.days || 0), 0)
  writeCell(worksheet, `${END_VESSEL_OTHER_VALUE_COLUMN}8`, formatYearMonthDuration(totalOther), 'center')

  END_ENGINE_TABLE_ROWS.forEach(([row, bucket]) => {
    const rowData = engineTable[bucket] || {}
    Object.entries(END_ENGINE_COLUMNS).forEach(([engineBucket, column]) => {
      writeCell(worksheet, `${column}${row}`, formatYearMonthDuration(rowData[engineBucket] || 0), 'center')
    })
  })
  Object.entries(END_ENGINE_COLUMNS).forEach(([engineBucket, column]) => {
    const total = END_ENGINE_TABLE_ROWS.reduce((sum, [, bucket]) => sum + (engineTable[bucket]?.[engineBucket] || 0), 0)
    writeCell(worksheet, `${column}16`, formatYearMonthDuration(total), 'center')
  })
}

function populateEndReferences(worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>) {
  ensureMerges(worksheet, Array.from({ length: 17 }, (_, index) => `C${24 + index}:H${24 + index}`))
  const currentEmployer = getByPath(payload, 'section18.currentEmployer') || {}
  writeCell(worksheet, 'H19', formatYesNoText(getByPath(payload, 'section18.objectionToContactLastEmployer')), 'center')
  writeCell(worksheet, 'C24', upper(currentEmployer.company), 'left')
  writeCell(worksheet, 'C25', upper(currentEmployer.contactPerson), 'left')
  writeCell(worksheet, 'C26', upper(splitAddressLine(normalizeText(currentEmployer.address), 0)), 'left')
  writeCell(worksheet, 'C27', upper(splitAddressLine(normalizeText(currentEmployer.address), 1)), 'left')
  writeCell(worksheet, 'C28', numeric(currentEmployer.phoneNumber), 'left')

  const refs = asArray(getByPath(payload, 'section18.references'))
  ;[
    ['31', '32', '33', '34', '35', refs[0]],
    ['36', '37', '38', '39', '40', refs[1]],
  ].forEach(([companyRow, nameRow, address1Row, address2Row, phoneRow, ref]) => {
    writeCell(worksheet, `C${companyRow}`, upper(ref?.company), 'left')
    writeCell(worksheet, `C${nameRow}`, upper(ref?.name), 'left')
    writeCell(worksheet, `C${address1Row}`, upper(splitAddressLine(normalizeText(ref?.address), 0)), 'left')
    writeCell(worksheet, `C${address2Row}`, upper(splitAddressLine(normalizeText(ref?.address), 1)), 'left')
    writeCell(worksheet, `C${phoneRow}`, numeric(ref?.phoneNumber), 'left')
  })
  writeCell(worksheet, 'A45', `Date: ${formatDate(new Date())}`, 'left')
}

async function tryInsertPhoto(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, payload: Record<string, unknown>, supabase: ReturnType<typeof createAdminSupabaseClient>) {
  const photoStoragePath = normalizeText(getByPath(payload, 'section2.photoStoragePath'))
  if (!photoStoragePath) return
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  if (!supabaseUrl) return
  const photoUrl = `${supabaseUrl}/storage/v1/object/public/application-photos/${encodeURI(photoStoragePath)}`
  try {
    const response = await fetch(photoUrl)
    if (!response.ok) return
    const bytes = new Uint8Array(await response.arrayBuffer())
    const imageId = workbook.addImage({ buffer: bytes, extension: 'png' })
    worksheet.addImage(imageId, 'G5:H14')
  } catch {
    // Leave workbook without image if photo fetch or embedding fails.
  }
}

function writeCell(worksheet: ExcelJS.Worksheet, cellRef: string, value: unknown, horizontal: 'left' | 'center' | undefined = undefined) {
  const cell = worksheet.getCell(cellRef)
  cell.value = value === undefined ? '' : value
  cell.alignment = {
    ...cell.alignment,
    horizontal: horizontal || cell.alignment?.horizontal,
    wrapText: false,
  }
}

function clearMainWorksheetOutputs(worksheet: ExcelJS.Worksheet) {
  clearCellList(worksheet, MAIN_MANAGED_CELLS)
  clearWorksheetRect(worksheet, 'B36:H41')
  clearWorksheetRect(worksheet, 'A45:H46')
  clearWorksheetRect(worksheet, 'A67:H68')
  clearWorksheetRect(worksheet, 'A72:H72')
  clearWorksheetRect(worksheet, 'A76:H77')
  clearWorksheetRect(worksheet, 'A81:H82')
  clearWorksheetRect(worksheet, 'F86:H117')
  clearWorksheetRect(worksheet, 'C122:H139')
}

function clearEndWorksheetOutputs(worksheet: ExcelJS.Worksheet) {
  clearWorksheetRect(worksheet, 'B3:G8')
  clearWorksheetRect(worksheet, 'B11:H16')
  clearCellList(worksheet, END_REFERENCE_LEFT_CELLS)
}

function clearCellList(worksheet: ExcelJS.Worksheet, refs: string[]) {
  for (const ref of refs) {
    worksheet.getCell(ref).value = ''
  }
}

function clearWorksheetRect(worksheet: ExcelJS.Worksheet, rangeRef: string) {
  const [startRef, endRef] = rangeRef.split(':')
  const start = worksheet.getCell(startRef)
  const end = worksheet.getCell(endRef || startRef)
  const top = Math.min(start.row, end.row)
  const bottom = Math.max(start.row, end.row)
  const left = Math.min(start.col, end.col)
  const right = Math.max(start.col, end.col)
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      worksheet.getRow(row).getCell(col).value = ''
    }
  }
}

function resolveWorksheetName(logicalName: string, sheetAliases: Record<string, string>) {
  return sheetAliases[logicalName] || logicalName
}

function aliasProtectedSheetNames(buffer: Uint8Array) {
  const sheetAliases: Record<string, string> = {}
  let workbookXml = readWorkbookXml(buffer)
  if (!workbookXml) {
    return { buffer, sheetAliases }
  }

  for (const [protectedName, aliasName] of Object.entries(PROTECTED_SHEET_ALIASES)) {
    const nextWorkbookXml = renameSheetInWorkbookXml(workbookXml, protectedName, aliasName)
    if (nextWorkbookXml === workbookXml) continue
    workbookXml = nextWorkbookXml
    sheetAliases[protectedName] = aliasName
  }

  if (Object.keys(sheetAliases).length === 0) {
    return { buffer, sheetAliases }
  }

  return {
    buffer: updateWorkbookXml(buffer, workbookXml),
    sheetAliases,
  }
}

function restoreProtectedSheetNames(buffer: Uint8Array, sheetAliases: Record<string, string>) {
  if (Object.keys(sheetAliases).length === 0) {
    return buffer
  }

  let workbookXml = readWorkbookXml(buffer)
  if (!workbookXml) {
    return buffer
  }

  for (const [protectedName, aliasName] of Object.entries(sheetAliases)) {
    workbookXml = renameSheetInWorkbookXml(workbookXml, aliasName, protectedName)
  }

  return updateWorkbookXml(buffer, workbookXml)
}

function readWorkbookXml(buffer: Uint8Array) {
  const archive = unzipSync(buffer)
  const workbookEntry = archive['xl/workbook.xml']
  if (!workbookEntry) return ''
  return strFromU8(workbookEntry)
}

function updateWorkbookXml(buffer: Uint8Array, workbookXml: string) {
  const archive = unzipSync(buffer)
  archive['xl/workbook.xml'] = strToU8(workbookXml)
  return new Uint8Array(zipSync(archive, { level: 6 }))
}

function renameSheetInWorkbookXml(workbookXml: string, fromName: string, toName: string) {
  const escapedFromName = escapeRegExp(fromName)
  const existingTargetPattern = new RegExp(`name="${escapeXmlAttribute(toName)}"`)
  if (existingTargetPattern.test(workbookXml)) {
    return workbookXml
  }

  const sheetPattern = new RegExp(`(<sheet[^>]*name=")${escapeXmlAttribute(fromName)}(")`, 'g')
  const renamedWorkbookXml = workbookXml.replace(sheetPattern, `$1${escapeXmlAttribute(toName)}$2`)

  if (renamedWorkbookXml === workbookXml) {
    return workbookXml
  }

  const definedNamePattern = new RegExp(`((?:'|&apos;))${escapedFromName}((?:'|&apos;)!)`, 'g')
  return renamedWorkbookXml.replace(definedNamePattern, `$1${toName}$2`)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function ensureMerges(worksheet: ExcelJS.Worksheet, ranges: string[]) {
  const existing = new Set(worksheet.model?.merges || [])
  for (const range of ranges) {
    if (!existing.has(range)) {
      try {
        worksheet.mergeCells(range)
      } catch {
        // ignore existing/invalid merge collisions
      }
    }
  }
}

function resolveMappingValue(payload: Record<string, unknown>, sourcePath: string, fieldKey: string) {
  if (sourcePath === 'system.currentDate') {
    return new Date()
  }
  return getByPath(payload, sourcePath) ?? getByPath(payload, fieldKey)
}

function asArray(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, any> => typeof item === 'object' && item !== null) : []
}

function upper(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function yesNo(value: unknown) {
  if (value == null || value === '') return ''
  return truthy(value) ? 'YES' : 'NO'
}

function concatAddress(values: unknown[]) {
  return values.map((value) => normalizeText(value).replace(/,+$/, '')).filter(Boolean).join(', ')
}

function concatNumeric(values: unknown[]) {
  return values.map((value) => numeric(value)).filter(Boolean).join('')
}

function numeric(value: unknown) {
  return normalizeNumeric(value)
}

function splitByComma(value: string, index: number) {
  return value.split(',').map((part) => part.trim()).filter(Boolean)[index] || ''
}

function excelDate(value: unknown) {
  const date = coerceDate(value)
  return date || ''
}

function formatYear(value: unknown) {
  const date = coerceDate(value)
  if (date) {
    return String(date.getFullYear())
  }

  const raw = normalizeText(value)
  if (!raw) return ''
  const fourDigitYear = raw.match(/\b(\d{4})\b/)
  return fourDigitYear ? fourDigitYear[1] : raw
}

function formatAge(value: unknown) {
  const date = coerceDate(value)
  if (!date) return ''
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const monthOffset = today.getMonth() - date.getMonth()
  if (monthOffset < 0 || (monthOffset === 0 && today.getDate() < date.getDate())) {
    age -= 1
  }
  return String(age)
}

function getHistorySeaServiceRows(payload: Record<string, unknown>) {
  return asArray(getByPath(payload, 'section16.seaService'))
    .sort((left, right) => historySortKey(right) - historySortKey(left))
    .slice(0, 17)
}

function historySortKey(entry: Record<string, any>) {
  const signOff = coerceDate(entry?.signOffDate)?.getTime() || 0
  const signOn = coerceDate(entry?.signOnDate)?.getTime() || 0
  return signOff * 10_000_000_000 + signOn
}

function calculateServiceDurationDays(signOn: unknown, signOff: unknown) {
  const start = coerceDate(signOn)
  const end = coerceDate(signOff)
  if (!start || !end || end < start) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000)
}

function formatMmDd(signOn: unknown, signOff: unknown) {
  const start = coerceDate(signOn)
  const end = coerceDate(signOff)
  if (!start || !end || end < start) return ''
  let months = 0
  let cursor = new Date(start)
  while (true) {
    const nextMonth = addOneCalendarMonth(cursor)
    if (nextMonth <= end) {
      months += 1
      cursor = nextMonth
    } else {
      break
    }
  }
  const days = Math.floor((end.getTime() - cursor.getTime()) / 86_400_000)
  return `${months}M/${days}D`
}

function addOneCalendarMonth(value: Date) {
  const next = new Date(value)
  next.setMonth(next.getMonth() + 1)
  return next
}

function buildVesselExperienceTable(seaService: Array<Record<string, any>>) {
  const table: Record<string, any> = {}
  END_VESSEL_TABLE_ROWS.forEach(([, bucket]) => {
    table[bucket] = { Container: 0, Tanker: 0, 'Bulk carrier': 0, Roro: 0, latest_other: null, _other_labels: {} }
  })
  seaService.forEach((entry) => {
    const bucket = normalizeSummaryRankBucket(entry.rankHeld || entry.position)
    if (!bucket || !table[bucket]) return
    const days = calculateServiceDurationDays(entry.signOnDate, entry.signOffDate)
    if (days <= 0) return
    const vesselBucket = normalizeVesselSummaryBucket(entry.vesselType)
    if (END_VESSEL_COLUMNS[vesselBucket as keyof typeof END_VESSEL_COLUMNS]) {
      table[bucket][vesselBucket] += days
      return
    }
    const label = upper(entry.vesselType)
    if (!label) return
    table[bucket]._other_labels[label] = (table[bucket]._other_labels[label] || 0) + days
    const latest = table[bucket].latest_other
    const key = historySortKey(entry)
    if (!latest || key > latest.sort_key) {
      table[bucket].latest_other = { label, days: table[bucket]._other_labels[label], sort_key: key }
    } else if (latest.label === label) {
      latest.days = table[bucket]._other_labels[label]
    }
  })
  return table
}

function buildEngineExperienceTable(seaService: Array<Record<string, any>>) {
  const table: Record<string, any> = {}
  END_ENGINE_TABLE_ROWS.forEach(([, bucket]) => {
    table[bucket] = Object.keys(END_ENGINE_COLUMNS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
  })
  seaService.forEach((entry) => {
    const bucket = normalizeEngineSummaryRankBucket(entry.rankHeld || entry.position)
    if (!bucket || !table[bucket]) return
    const days = calculateServiceDurationDays(entry.signOnDate, entry.signOffDate)
    if (days <= 0) return
    const engineFamily = normalizeEngineFamilyBucket(entry.engineFamily)
    if (!engineFamily) return
    table[bucket][engineFamily] += days
  })
  return table
}

function formatYearMonthDuration(totalDays: number) {
  if (totalDays <= 0) return ''
  const years = Math.floor(totalDays / 365)
  const remaining = totalDays % 365
  const months = Math.floor(remaining / 30)
  const days = remaining % 30
  return `${years}Y/${months}M/${days}D`
}

function normalizeSummaryRankBucket(value: unknown) {
  const normalized = canonicalizeSummaryValue(value)
  if (['master', 'captain', 'chief engineer', 'c/e'].includes(normalized)) return 'Master - C/E'
  if (['chief officer', 'c/o', 'second engineer', '2/e'].includes(normalized)) return 'C/O - 2/E'
  if (['second officer', '2/o', 'third engineer', '3/e'].includes(normalized)) return '2/O - 3/E'
  if (['third officer', '3/o', 'fourth engineer', '4/e'].includes(normalized)) return '3/O - 4/E'
  if (['electrical officer', 'electro technical officer', 'eto', 'e/o', 'electrical engineer'].includes(normalized)) return 'E/O'
  return null
}

function normalizeEngineSummaryRankBucket(value: unknown) {
  const normalized = canonicalizeSummaryValue(value)
  if (['chief engineer', 'c/e'].includes(normalized)) return 'C/E'
  if (['second engineer', '2/e'].includes(normalized)) return '2/E'
  if (['third engineer', '3/e'].includes(normalized)) return '3/E'
  if (['fourth engineer', '4/e'].includes(normalized)) return '4/E'
  if (['electrical officer', 'electro technical officer', 'eto', 'e/o', 'electrical engineer'].includes(normalized)) return 'E/O'
  return null
}

function normalizeVesselSummaryBucket(value: unknown) {
  const normalized = canonicalizeSummaryValue(value)
  if (normalized === 'pc') return 'Container'
  if (normalized === 'bc') return 'Bulk carrier'
  if (['lng', 'lpg', 'chem'].includes(normalized)) return 'Tanker'
  if (normalized === 'roro') return 'Roro'
  return 'Others'
}

function normalizeEngineFamilyBucket(value: unknown) {
  const normalized = canonicalizeSummaryValue(value)
  return ({
    'sulzer rta': 'Sulzer RTA',
    'sulzer rnd': 'Sulzer RND',
    'b & w': 'B & W',
    'b&w': 'B & W',
    man: 'MAN',
    'semt pielstick': 'SEMT Pielstick',
    'steam turbine': 'Steam Turbine',
    others: 'Others',
    other: 'Others',
  } as Record<string, string>)[normalized] || null
}

function canonicalizeSummaryValue(value: unknown) {
  return normalizeText(value).replace(/’/g, "'").split(/\s+/).filter(Boolean).join(' ').toLowerCase()
}

function transformValue(value: unknown, transform: string, fieldKey: string) {
  switch (transform) {
    case 'uppercase':
      return normalizeText(value).toUpperCase()
    case 'text':
    case 'alphanumeric':
      return normalizeText(value)
    case 'numeric':
      return normalizeNumeric(value)
    case 'yes_no_text':
      return normalizeYesNo(value)
    case 'ddmmyyyy':
      return formatDate(value)
    case 'integer':
      return value == null || value === '' ? '' : String(value)
    case 'concat_address_uppercase':
      return normalizeText(value).toUpperCase()
    case 'concat_numeric':
      return normalizeNumeric(value)
    case 'split_merged':
      return splitAddressLine(normalizeText(value), fieldKey.endsWith('.line2') ? 1 : 0).toUpperCase()
    case 'date_label':
      return `Date: ${formatDate(value)}`
    default:
      return normalizeText(value)
  }
}

function normalizeLanguageLevel(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'elementary' || normalized === 'beginner') return 'beginner'
  if (normalized === 'intermediate') return 'intermediate'
  if (['advanced', 'native', 'native/bilingual', 'bilingual'].includes(normalized)) return 'advanced'
  return normalized
}

function canonicalizeVisaType(value: unknown) {
  return normalizeText(value).toLowerCase().trim()
}

function canonicalizeMarineCourseName(value: unknown) {
  const normalized = canonicalizeSummaryValue(value)
  const aliases: Record<string, string> = {
    'arpa/ncc': 'arpa / ncc',
    'arpa / ncc': 'arpa / ncc',
    'btm/etm': 'btm / etm',
    'btm / etm': 'btm / etm',
    sso: 'ship security officer (sso)',
    'ship security officer (sso)': 'ship security officer (sso)',
    'ship handling': 'ship handling & manoeuvring',
    'loading software': 'loading software (name it)',
    simulator: 'large vessel handling simulator / engine room simulator',
    'revalidation certificate': 'revalidation course for renewal of coc',
    'high voltage': 'high voltage training',
    "engine maker's": "engine maker's training",
    'engine maker’s training': "engine maker's training",
    'crane training': 'crane manufactures training',
    'vessel security certificate': 'vessel security training course',
  }
  return aliases[normalized] || normalized
}

function canonicalizeFlagStateName(value: unknown) {
  return canonicalizeSummaryValue(value)
}

function canonicalizeFlagStateEndorsementType(flagState: unknown, value: unknown) {
  const normalizedFlagState = canonicalizeFlagStateName(flagState)
  const normalizedValue = canonicalizeSummaryValue(value)
  const aliases: Record<string, Record<string, string>> = {
    'recognition of coc': {
      cyprus: 'cert. of recognition of the national coc',
      default: 'endorsement of the coc',
      'united kingdom': 'endorsement of the coc (uk cec)',
    },
    'endorsement of the coc': {
      'united kingdom': 'endorsement of the coc (uk cec)',
    },
    'endorsement of the gmdss': {
      panama: 'endorsement of the gmdss goc',
    },
  }
  const alias = aliases[normalizedValue]
  if (!alias) return normalizedValue
  return alias[normalizedFlagState] || alias.default || normalizedValue
}

function coerceDate(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const raw = normalizeText(value)
  if (!raw) return null
  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) return direct
  const ddmmyyyy = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function formatYesNoText(value: unknown) {
  const normalized = canonicalizeSummaryValue(value)
  if (normalized === 'yes' || normalized === 'true') return 'YES'
  if (normalized === 'no' || normalized === 'false') return 'NO'
  return ''
}

function truthy(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Boolean(value)
  return ['true', '1', 'yes', 'y'].includes(normalizeText(value).toLowerCase())
}

function splitAddressLine(value: string, lineIndex: number) {
  if (!value) return ''
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return value
  const midpoint = Math.ceil(words.length / 2)
  const lines = [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
  return lines[lineIndex] || ''
}

function normalizeText(value: unknown) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function normalizeNumeric(value: unknown) {
  if (value == null) return ''
  return String(value).replace(/\D+/g, '')
}

function normalizeYesNo(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'yes' || normalized === 'true') return 'YES'
  if (normalized === 'no' || normalized === 'false') return 'NO'
  return ''
}

function formatDate(value: unknown) {
  if (!value) return ''
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return normalizeText(value)
  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()
  return `${day}/${month}/${year}`
}

function getByPath(value: unknown, path: string) {
  if (!path) return null
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((accumulator, key) => {
      if (accumulator == null) return null
      if (typeof accumulator !== 'object') return null
      if (!(key in accumulator)) return null
      return (accumulator as Record<string, unknown>)[key]
    }, value)
}

async function getAuthorizedUser(req: Request, supabase: ReturnType<typeof createAdminSupabaseClient>, permissionName: string) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) return null

  const { data: hasPermission, error: permissionError } = await supabase.rpc('has_permission', {
    user_uuid: user.id,
    permission_name: permissionName,
  })

  if (permissionError || hasPermission !== true) return null
  return user
}

function mapping(sectionLabel: string, fieldKey: string, fieldLabel: string, sourcePath: string, sheetName: string, cellRef: string, transform: string, sortOrder: number) {
  return {
    section_label: sectionLabel,
    field_key: fieldKey,
    field_label: fieldLabel,
    source_path: sourcePath,
    sheet_name: sheetName,
    cell_ref: cellRef,
    transform,
    sort_order: sortOrder,
  }
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
