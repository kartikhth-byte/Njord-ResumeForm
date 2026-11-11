// Group by reviewed IDs only: identical spelling never implies shared ownership.
export function groupRequirements(rows, companies = [], ships = []) {
  const companyById = new Map(companies.map(row => [row.id, row]))
  const shipById = new Map(ships.map(row => [row.id, row]))
  const groups = new Map()
  for (const row of rows) {
    const company = companyById.get(row.company_id)
    const companyKey = row.company_id || 'unmapped'
    if (!groups.has(companyKey)) groups.set(companyKey, {
      id: companyKey,
      name: row.company_id ? company?.name || row.customer_name || 'Company unavailable' : 'Company pending / not mapped',
      archived: !!company?.archived_at, ships: new Map(), count: 0,
    })
    const group = groups.get(companyKey)
    const ship = shipById.get(row.ship_id)
    // Invalid historical relationships remain visible without assigning ownership.
    const validShip = ship && ship.company_id === row.company_id ? ship : null
    const shipKey = row.ship_id || `pending-${row.id}`
    if (!group.ships.has(shipKey)) group.ships.set(shipKey, {
      id: `${companyKey}:${shipKey}`,
      name: row.ship_id ? validShip?.name || row.vessel_name || 'Ship unavailable' : 'Ship pending / not mapped',
      archived: !!validShip?.archived_at, rows: [],
    })
    group.ships.get(shipKey).rows.push(row)
    group.count += 1
  }
  const byName = (a, b) => Number(a.id === 'unmapped') - Number(b.id === 'unmapped') || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  return [...groups.values()].sort(byName).map(group => ({...group, ships: [...group.ships.values()].sort(byName)}))
}
