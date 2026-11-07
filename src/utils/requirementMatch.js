export const matchLabels = {
  confirmed_match: 'Confirmed match', relevant_candidate: 'Relevant candidate',
  needs_more_evidence: 'Needs more evidence', not_a_fit: 'Not a fit',
}
export function criterionLabel(family) {
  return ({ nationality_match: 'Nationality', experience_ship_type: 'Vessel experience',
    present_rank: 'Present rank', rank_match: 'Present rank', rank: 'Present rank' })[family] || String(family).replaceAll('_', ' ')
}
export function matchAssessment(row) {
  const verdicts = row.verdicts || []
  const confirmed = verdicts.filter(v => v.verdict === 'PASS').length
  return verdicts.length ? `${confirmed} of ${verdicts.length} criteria confirmed` : 'Assessment unavailable'
}
export function attachedCase(row, requirementId) {
  return row.cases?.find(c => c.requirement_id === requirementId)
}
