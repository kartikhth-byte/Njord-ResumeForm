import { displayRankName } from './directoryDisplay.js'

// Fill only empty form fields from the CV. The recruiter checks every value
// before saving; nothing here is saved on its own.
const fromCv = { full_name: 'name', email: 'email', phone: 'telephone' }
const ordinals = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th' }
// Common CV spellings of the ranks stored in Holmes.
const aliases = { 'able seaman': 'ab', 'able bodied seaman': 'ab', 'ordinary seaman': 'os', 'general purpose': 'gp', eto: 'electro technical officer',
  'electro-technical officer': 'electro technical officer', captain: 'master', 'c/o': 'chief officer', 'chief mate': 'chief officer',
  '2/o': '2nd officer', '2nd mate': '2nd officer', '3/o': '3rd officer', '3rd mate': '3rd officer', 'c/e': 'chief engineer',
  '2/e': '2nd engineer', '3/e': '3rd engineer', '4/e': '4th engineer', boatswain: 'bosun', 'ch.cook': 'chief cook', 'ch cook': 'chief cook' }
const key = value => {
  const text = String(value || '').toLowerCase().replace(/\.(?!\w)/g, '').replace(/\b(first|second|third|fourth|fifth)\b/g, word => ordinals[word]).replace(/\s+/g, ' ').trim()
  return aliases[text] || text
}
const sameName = (a, b) => key(a) !== '' && key(a) === key(b)

// One value per field: the only value, or, when the CV gives several, the one
// with the clearly strongest label ("Present rank" over "Post applied for" over
// a passing mention). Ties are left for the recruiter.
function pick(resume, field) {
  const rows = resume?.fields?.[field] || []
  if (!rows.length) return ''
  if (!resume.conflicts?.includes(field)) return rows[0].value
  const top = Math.max(...rows.map(row => row.confidence || 0))
  const best = rows.filter(row => (row.confidence || 0) === top)
  return top >= 0.7 && best.length === 1 ? best[0].value : ''
}

export function fillFromCv(fields, resume, ranks = [], vesselTypes = []) {
  const next = { ...fields }
  const first = field => pick(resume, field)
  for (const [field, target] of Object.entries(fromCv)) {
    const value = first(field)
    if (value && !next[target]) next[target] = String(value).trim()
  }
  const rankName = first('present_rank')
  const rank = rankName && ranks.find(row => sameName(row.name, rankName) || sameName(displayRankName(row.name), rankName))
  if (rank && !next.rankId) next.rankId = rank.id
  const vessel = first('vessel_type') && vesselTypes.find(row => sameName(row.name, first('vessel_type')))
  if (vessel && !next.vesselTypeId) next.vesselTypeId = vessel.id
  return next
}
