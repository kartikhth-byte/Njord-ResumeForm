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

// UI guidance only: the bridge re-reads the requirement, fleet and version
// under the caller's permissions before matching or serving an original.
export function requirementMatchBlocker(requirement) {
  if (requirement.deleted_at) return 'Deleted requirements cannot be matched.'
  if (requirement.archived_at || requirement.isArchived) return 'Archived requirements cannot be matched.'
  if (requirement.status !== 'open') return 'Open this requirement before matching.'
  if (!requirement.company_id || !requirement.ship_id || !requirement.location_reviewed_at) return 'Review the company and ship before matching.'
  if (!requirement.rank_id || !requirement.vessel_type_id) return 'Set present rank and vessel type before matching.'
  if (!Number.isInteger(requirement.version)) return 'Refresh this requirement before matching.'
  return ''
}
