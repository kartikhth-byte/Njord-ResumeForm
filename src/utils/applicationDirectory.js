// An application can serve several cases, including closed cycles. A ship row
// represents the form once, with every exact linked requirement listed beneath it.
export function applicationPlacements(applications, context) {
  const requirements = new Map(context.requirements.map(r => [r.id, r]))
  const companies = new Map(context.companies.map(r => [r.id, r]))
  const ships = new Map(context.ships.map(r => [r.id, r]))
  const byApplication = new Map()
  for (const row of context.cases) {
    if (!byApplication.has(row.application_id)) byApplication.set(row.application_id, [])
    byApplication.get(row.application_id).push(row)
  }
  return applications.flatMap(application => {
    const linked = (byApplication.get(application.id) || []).filter(c => c.prospect_id === application.prospect_id)
    if (!linked.length) return [{ id: `${application.id}:unlinked`, application, companyId: '', shipId: '', companyName: 'Not linked', shipName: '', links: [] }]
    const placements = new Map()
    for (const row of linked) {
      const requirement = requirements.get(row.requirement_id)
      const companyId = requirement?.company_id || '', shipId = requirement?.ship_id || ''
      const key = JSON.stringify([companyId, shipId])
      if (!placements.has(key)) placements.set(key, {
        id: `${application.id}:${key}`, application, companyId, shipId,
        companyName: companies.get(companyId)?.name || 'Company not mapped',
        shipName: ships.get(shipId)?.name || 'Ship not mapped', links: [],
      })
      placements.get(key).links.push({ ...row, requirementName: requirement?.req_id_display || 'Requirement unavailable' })
    }
    return [...placements.values()]
  })
}
export function filterApplicationPlacements(rows, { company = '', ship = '', requirement = '', q = '', checks = 'all' } = {}) {
  const term = q.trim().toLowerCase()
  return rows.flatMap(row => {
    if ((company && row.companyId !== company) || (ship && row.shipId !== ship)) return []
    const links = requirement ? row.links.filter(c => c.requirement_id === requirement) : row.links
    if (requirement && !links.length) return []
    if (checks !== 'all' && row.application.compliance_status !== checks) return []
    if (term && ![row.application.full_name, row.application.email, row.application.reference_number, row.application.desired_rank, row.companyName, row.shipName, ...links.map(c => c.requirementName)].some(value => String(value || '').toLowerCase().includes(term))) return []
    return [{ ...row, links }]
  })
}
export function groupApplicationPlacements(rows) {
  const groups = new Map()
  for (const row of rows) {
    const id = row.links.length ? `company:${row.companyId}` : 'unlinked'
    if (!groups.has(id)) groups.set(id, { id, name: row.companyName, unlinked: !row.links.length, ships: new Map(), ids: new Set() })
    const group = groups.get(id)
    group.ids.add(row.application.id)
    if (!group.ships.has(row.shipId)) group.ships.set(row.shipId, { id: row.shipId, name: row.shipName, rows: [] })
    group.ships.get(row.shipId).rows.push(row)
  }
  const byName = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  return [...groups.values()].sort(byName).map(g => ({ ...g, count: g.ids.size, ships: [...g.ships.values()].sort(byName) }))
}
export function matchesLegacyApplicationStatus(status, filter) {
  const stages = { review: ['submitted','new','under_review'], test: ['test_scheduled','test_completed','test_passed','test_failed'], interview: ['interview_scheduled','interview_completed','interview_passed','second_interview_scheduled','second_interview_completed'], offer: ['offered','offer_accepted','documents_pending'], closed: ['hired','rejected','withdrawn'] }
  if (!filter) return true
  if (filter === 'all') return !stages.closed.includes(status)
  return stages[filter] ? stages[filter].includes(status) : status === filter
}
// Accept only the existing advanced-filter shape from saved URLs.
export function readApplicationFilters(raw) {
  try {
    const value = JSON.parse(raw || '{}'), result = {}
    for (const key of ['position','vesselType','nationality','experienceRange','certificateGrade','visaType','flagState','availability','ageRange']) {
      if (typeof value?.[key] === 'string' && value[key]) result[key] = value[key]
    }
    const dates = {}
    for (const key of ['from','to']) if (/^\d{4}-\d{2}-\d{2}$/.test(value?.dateRange?.[key] || '')) dates[key] = value.dateRange[key]
    if (Object.keys(dates).length) result.dateRange = dates
    return result
  } catch { return {} }
}
