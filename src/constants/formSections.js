export const FORM_SECTION_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
]

export const MANDATORY_SECTION_NUMBERS = [
  1, 2, 3, 4, 6, 8, 10, 11, 13, 14, 16, 18, 19,
]

export const FORM_SECTIONS = [
  { id: 1, title: 'Availability & Application', shortTitle: 'Availability' },
  { id: 2, title: 'Personal & Contact Details', shortTitle: 'Personal' },
  { id: 3, title: 'Passport Details', shortTitle: 'Passport' },
  { id: 4, title: "CDC / Seaman's Book", shortTitle: 'CDC' },
  { id: 5, title: 'Visas', shortTitle: 'Visas' },
  { id: 6, title: 'Education Background', shortTitle: 'Education' },
  { id: 7, title: 'Dependents', shortTitle: 'Dependents' },
  { id: 8, title: 'Certificates of Competency', shortTitle: 'Certificates' },
  { id: 9, title: 'GMDSS Certificates', shortTitle: 'GMDSS' },
  { id: 10, title: 'Medical & Vaccination', shortTitle: 'Medical' },
  { id: 11, title: 'Medical History', shortTitle: 'Med History' },
  { id: 12, title: 'Foreign Languages', shortTitle: 'Languages' },
  { id: 13, title: 'Physical & Uniform Details', shortTitle: 'Physical' },
  { id: 14, title: 'STCW & Marine Courses', shortTitle: 'STCW' },
  { id: 15, title: 'Flag State Documents', shortTitle: 'Flag State' },
  { id: 16, title: 'Sea Service', shortTitle: 'Sea Service' },
  { id: 17, title: 'Experience Summary', shortTitle: 'Experience' },
  { id: 18, title: 'References', shortTitle: 'References' },
  { id: 19, title: 'Declaration & Consent', shortTitle: 'Declaration' },
]

export const FORM_SECTION_NAME_MAP = Object.fromEntries(
  FORM_SECTIONS.map((section) => [section.id, section.title])
)
