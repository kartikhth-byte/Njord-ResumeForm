import { displayRankName } from './directoryDisplay'

// Fill only empty form fields from the first unconflicted CV value. The recruiter
// checks every value before saving; nothing here is saved on its own.
const fromCv = { full_name: 'name', email: 'email', phone: 'telephone' }
const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

export function fillFromCv(fields, resume, ranks = [], vesselTypes = []) {
  const next = { ...fields }
  const first = key => !resume?.conflicts?.includes(key) && resume?.fields?.[key]?.[0]?.value
  for (const [key, target] of Object.entries(fromCv)) {
    const value = first(key)
    if (value && !next[target]) next[target] = String(value).trim()
  }
  const rank = first('present_rank') && ranks.find(row => sameName(row.name, first('present_rank')) || sameName(displayRankName(row.name), first('present_rank')))
  if (rank && !next.rankId) next.rankId = rank.id
  const vessel = first('vessel_type') && vesselTypes.find(row => sameName(row.name, first('vessel_type')))
  if (vessel && !next.vesselTypeId) next.vesselTypeId = vessel.id
  return next
}
