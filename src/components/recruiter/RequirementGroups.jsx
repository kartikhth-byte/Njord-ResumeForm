import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronDown, ChevronRight, ClipboardList, Ship } from 'lucide-react'
import { groupRequirements } from '../../utils/requirementGroups'
import { requirementMatchBlocker } from '../../utils/requirementMatch'
import { ON_TIME_BADGE_CLASSES } from '../../utils/kpiTracker'
import { getStatusMeta, REQUIREMENT_STATUS_META, formatDate } from '../../pages/recruiterDashboardUtils'

function GroupHeader({ icon, name, label, count, open, onClick, controls, tone, archived }) {
  const Icon = icon
  return <button type="button" aria-label={`${label}: ${name}, ${count} ${count === 1 ? 'requirement' : 'requirements'}`} aria-expanded={open} aria-controls={controls} onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${tone}`}>
    {open ? <ChevronDown className="h-4 w-4 shrink-0"/> : <ChevronRight className="h-4 w-4 shrink-0"/>}
    <Icon className="h-5 w-5 shrink-0" aria-hidden="true"/>
    <span className="min-w-0 flex-1 break-words"><span className="mr-2 block text-[10px] sm:inline font-semibold uppercase tracking-wider opacity-70">{label}</span><span className="font-semibold">{name}</span>{archived && <span className="ml-2 text-xs">(archived)</span>}</span>
    <span className="shrink-0 text-xs text-fg-muted">{count}<span className="hidden sm:inline"> {count === 1 ? 'requirement' : 'requirements'}</span></span>
  </button>
}

export default function RequirementGroups({ rows, fleet, data, canMatch, onMatch, matchButtons, from }) {
  const groups = useMemo(() => groupRequirements(rows, fleet.companies, fleet.ships), [rows, fleet.companies, fleet.ships])
  const [collapsed, setCollapsed] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())
  const toggle = (setter, key) => setter(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  return <div className="space-y-5" aria-label="Requirements by company and ship">
    {groups.map(company => <section key={company.id} aria-label={company.name} className="overflow-hidden rounded-xl border border-line">
      <GroupHeader icon={Building2} name={company.name} label="Company" count={company.count} archived={company.archived} open={!collapsed.has(company.id)} controls={`company-reqs-${company.id}`} onClick={() => toggle(setCollapsed, company.id)} tone="bg-accent-soft text-accent-text"/>
      {!collapsed.has(company.id) && <div id={`company-reqs-${company.id}`}>
        {company.ships.map(ship => <div key={ship.id} className="border-t border-line">
          <GroupHeader icon={Ship} name={ship.name} label="Ship" count={ship.rows.length} archived={ship.archived} open={!collapsed.has(ship.id)} controls={`ship-reqs-${ship.id}`} onClick={() => toggle(setCollapsed, ship.id)} tone="bg-raised text-fg-secondary"/>
          {!collapsed.has(ship.id) && <div id={`ship-reqs-${ship.id}`}>
            {ship.rows.map(row => {
              const open = expanded.has(row.id)
              const status = getStatusMeta(REQUIREMENT_STATUS_META, row.status)
              const blocker = requirementMatchBlocker(row)
              const candidateCount = new Set(data.cases.filter(item => item.requirement_id === row.id).map(item => item.prospect_id)).size
              return <article key={row.id} aria-label={row.reqId} className="border-t border-line bg-surface">
                <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                  <button type="button" aria-expanded={open} aria-controls={`requirement-${row.id}`} aria-label={`Details for ${row.reqId}`} className="flex min-w-0 flex-[2_1_14rem] items-center gap-3 text-left" onClick={() => toggle(setExpanded, row.id)}>
                    {open ? <ChevronDown className="h-4 w-4 shrink-0"/> : <ChevronRight className="h-4 w-4 shrink-0"/>}<ClipboardList className="h-5 w-5 shrink-0 text-fg-muted" aria-hidden="true"/>
                    <span className="min-w-0"><span className="block break-words font-semibold">{row.rankName}</span><span className="block break-words text-xs text-fg-muted">{row.reqId} · {row.vesselTypeName}</span></span>
                  </button>
                  <div className="flex flex-1 flex-wrap items-center gap-3 text-sm">
                    <span className="whitespace-nowrap"><strong>{row.joinedCount} / {row.positions_required ?? '—'}</strong> <span className="text-fg-muted">filled</span></span>
                    <span className={`tracker-pill ${status.className}`}>{status.label}</span>
                    {row.isArchived && <span className="tracker-pill bg-line text-fg-secondary">Archived</span>}
                    <span className={`tracker-pill ${ON_TIME_BADGE_CLASSES[row.onTimeStatus]}`}>{row.onTimeStatus}</span>
                  </div>
                  {data.casesAvailable && <Link className="text-sm text-accent-text underline" to={`/recruiter/candidates?view=all&requirement=${encodeURIComponent(row.id)}`}>{candidateCount} attached {candidateCount === 1 ? 'candidate' : 'candidates'}</Link>}
                  {canMatch && <div className="min-w-0">
                    <button type="button" ref={element => { if (element) matchButtons.current.set(row.id, element); else matchButtons.current.delete(row.id) }} className="workspace-action-button workspace-action-button--secondary disabled:opacity-50" disabled={!!blocker} aria-haspopup="dialog" aria-label={`Match résumés for ${row.reqId}`} aria-describedby={blocker ? `match-blocker-${row.id}` : undefined} onClick={() => onMatch(row)}>Match résumés</button>
                    {blocker && <p id={`match-blocker-${row.id}`} className="mt-1 max-w-56 text-xs text-fg-muted">{blocker}</p>}
                  </div>}
                </div>
                {open && <div id={`requirement-${row.id}`} className="space-y-4 border-t border-dashed border-line px-4 py-4">
                  <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    {[['Opened', formatDate(row.date_opened)], ['Closed', row.date_closed ? formatDate(row.date_closed) : '—'], ['Days open / target', `${row.daysOpen ?? '—'} / ${row.targetDays ?? '—'}`], ['Recruiter', row.recruiterName], ['Saved company', row.customer_name || 'Not set'], ['Saved ship', row.vessel_name || 'Not set']].map(([label, value]) => <div key={label}><dt className="text-xs text-fg-muted">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
                  </dl>
                  {row.latestRemark || row.closure_reason ? <p className="break-words text-sm text-fg-secondary">{row.latestRemark || row.closure_reason}</p> : null}
                  <Link className="workspace-action-button workspace-action-button--secondary" to={`/recruiter/workspace/requirements/${row.id}`} state={{from}}>Open requirement</Link>
                </div>}
              </article>
            })}
          </div>}
        </div>)}
      </div>}
    </section>)}
  </div>
}
