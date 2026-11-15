import { useState } from 'react'
import { Building2, ChevronDown, ChevronRight, Ship } from 'lucide-react'

export default function GroupedDirectoryTable({ groups, columns, renderRows, getShipRows = ship => ship.rows, tableClassName = '', colWidths, ungroupedRows = [], label }) {
  const [collapsed, setCollapsed] = useState(new Set())
  let serial = 0
  let visibleHeaderShown = false
  const toggle = key => setCollapsed(previous => {
    const next = new Set(previous)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  const table = (rows, name) => {
    const start = serial
    serial += rows.length
    const showHeader = !visibleHeaderShown
    visibleHeaderShown = true
    return <div className="tracker-table-wrap" tabIndex={0} aria-label={name}>
      <table className={`tracker-table ${tableClassName}`}>
        {colWidths && <colgroup>{colWidths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>}
        <thead className={showHeader ? undefined : 'sr-only'}><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{renderRows(rows, start)}</tbody>
      </table>
    </div>
  }
  const heading = (kind, name, count, key) => <button type="button" aria-label={`${kind}: ${name}`} aria-expanded={!collapsed.has(key)} onClick={() => toggle(key)} className={`directory-group__heading ${kind === 'Company' ? 'directory-group__heading--company' : 'directory-group__heading--ship'}`}>
    {collapsed.has(key) ? <ChevronRight aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
    {kind === 'Company' ? <Building2 aria-hidden="true" size={16} /> : <Ship aria-hidden="true" size={16} />}
    <span className="min-w-0 flex-1 truncate">{name}</span><span className="text-xs font-normal text-fg-muted">{count}</span>
  </button>
  return <section aria-label={label} className="space-y-3">
    {groups.map(company => {
      const companyKey = `company:${company.id}`
      return <div key={companyKey} className="directory-group">
        {heading('Company', company.name, company.count, companyKey)}
        {!collapsed.has(companyKey) && <div className="directory-group__ships">{company.ships.map(ship => {
          const shipKey = `${companyKey}:ship:${ship.id}`
          const rows = getShipRows(ship)
          return <div key={shipKey} className="directory-group__ship">
            {heading('Ship', ship.name, rows.length, shipKey)}
            {!collapsed.has(shipKey) && table(rows, `${company.name} · ${ship.name}`)}
          </div>
        })}</div>}
      </div>
    })}
    {ungroupedRows.length > 0 && <div className="directory-group">{table(ungroupedRows, label)}</div>}
    {!groups.length && !ungroupedRows.length && table([], label)}
  </section>
}
