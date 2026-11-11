import { groupRequirements } from './requirementGroups.js'
import { CASE_TERMINAL_STATUSES } from './recruitmentCase.js'

export function attachmentIsActive(link) {
  const r = link.requirement
  return r?.status === 'open' && !r.archived_at && !r.deleted_at &&
    !CASE_TERMINAL_STATUSES.includes(link.status) && !['joined', 'customer_rejected'].includes(link.status)
}
export function candidateAttachmentState(row) {
  return (row.attachedRequirements || []).some(attachmentIsActive) ? 'attached' : 'unattached'
}
export function matchingCandidateLinks(row, filter = {}, history = 'active') {
  return (row.attachedRequirements || []).filter(link => {
    const r = link.requirement || {}
    return (history === 'all' || (history === 'history' ? !attachmentIsActive(link) : attachmentIsActive(link))) &&
      (!filter.company || r.company_id === filter.company) && (!filter.ship || r.ship_id === filter.ship) &&
      (!filter.requirement || link.requirementId === filter.requirement) && (!filter.stage || link.status === filter.stage)
  })
}
export function groupCandidateAttachments(rows, companies, ships, filter, history) {
  const requirements = new Map()
  for (const row of rows) for (const link of matchingCandidateLinks(row, filter, history)) {
    if (!requirements.has(link.requirementId)) requirements.set(link.requirementId, {
      ...link.requirement, id: link.requirementId, candidates: [],
    })
    requirements.get(link.requirementId).candidates.push({ row, link })
  }
  return groupRequirements([...requirements.values()], companies, ships).map(company => ({ ...company,
    ships: company.ships.map(ship => {
      const candidates = new Map()
      for (const requirement of ship.rows) for (const { row, link } of requirement.candidates) {
        if (!candidates.has(row.id)) candidates.set(row.id, { row, links: [] })
        candidates.get(row.id).links.push(link)
      }
      return { ...ship, candidates: [...candidates.values()] }
    }),
  }))
}
export function resumeReadiness(status) {
  if (!status) return { label: 'CV linked', ready: false }
  if (status.original_available === false || status.review_required || status.status === 'failed') return { label: 'CV needs attention', ready: false }
  if (status.platform) return { label: status.storage_status === 'stored' && status.identity_status === 'linked' ? 'CV ready' : 'CV needs attention', ready: status.storage_status === 'stored' && status.identity_status === 'linked' }
  if (status.original_available === true && status.status === 'ready') return { label: 'CV ready', ready: true }
  return { label: 'CV processing', ready: false }
}
