import { displayRankName } from './directoryDisplay.js'

// Fill only empty form fields from the CV. The recruiter
// checks every value before saving; nothing here is saved on its own.
const fromCv = { full_name: 'name', email: 'email', phone: 'telephone' }
const ordinals = { first: '1st', second: '2nd', third: '3rd', fourth: '4th' }
const key = value => String(value || '').toLowerCase().replace(/[.]/g, '').replace(/\b(first|second|third|fourth)\b/g, word => ordinals[word]).replace(/\s+/g, ' ').trim()
const sameName = (a, b) => key(a) !== '' && key(a) === key(b)

// One value per field: the only value, or, when the CV mentions several, the one
// clearly labelled (for example "Rank: Second Officer") ahead of table mentions.
function pick(resume, field) {
  const rows = resume?.fields?.[field] || []
  if (!rows.length) return ''
  if (!resume.conflicts?.includes(field)) return rows[0].value
  const top = Math.max(...rows.map(row => row.confidence || 0))
  const best = rows.filter(row => (row.confidence || 0) === top)
  return top >= 0.9 && best.length === 1 ? best[0].value : ''
}

export function fillFromCv(fields, resume, ranks = [], vesselTypes = []) {
  const next = { ...fields }
  const first = field => pick(resume, field)
  for (const [field, target] of Object.entries(fromCv)) {
    const value = first(field)
    if (value && !next[target]) next[target] = String(value).trim()
  }
  const rank = first('present_rank') && ranks.find(row => sameName(row.name, first('present_rank')) || sameName(displayRankName(row.name), first('present_rank')))
  if (rank && !next.rankId) next.rankId = rank.id
  const vessel = first('vessel_type') && vesselTypes.find(row => sameName(row.name, first('vessel_type')))
  if (vessel && !next.vesselTypeId) next.vesselTypeId = vessel.id
  return next
}
