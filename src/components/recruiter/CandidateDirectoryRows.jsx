import { Link } from 'react-router-dom'
import { Building2, Ship } from 'lucide-react'
import { groupCandidateAttachments, resumeReadiness } from '../../utils/candidateDirectory'
import { openCandidateResume } from '../../services/needleIntegrationService'

export function CandidateRow({ row, links = [], from, canEdit, canAttach, onEdit, onAttach, onError }) {
  return <article aria-label={row.name || 'Unnamed candidate'} className="flex flex-wrap items-center gap-4 border-t border-line bg-surface px-4 py-4">
    <div className="min-w-0 flex-[2_1_15rem]">
      {row.isDraft ? <h3 className="font-semibold break-words">{row.name || 'Unnamed candidate'}</h3> : <Link className="font-semibold text-accent-text hover:underline break-words" to={`/recruiter/workspace/prospects/${row.id}`} state={{from}}>{row.name}</Link>}
      <p className="text-xs text-fg-muted break-words">{row.email || row.telephone || 'Contact details missing'}</p>
    </div>
    <div className="flex-[1_1_10rem] text-sm"><p>{row.rankName || 'Rank not provided'}</p><p className="text-xs text-fg-muted">{row.vesselTypeName || 'Vessel type not provided'}</p></div>
    <div className="flex-[1_1_10rem] text-sm"><span className={`tracker-pill ${row.needle_resume_id ? 'bg-accent-soft text-accent-text' : 'bg-warning-soft text-warning'}`}>{row.needle_resume_id ? resumeReadiness(row.cvStatus).label : 'CV missing'}</span>
      {!links.length && row.attachedRequirements?.length > 0 ? <p className="mt-1 text-xs text-fg-muted">No active attachment · {row.attachedRequirements.length} in history</p> : null}
      {row.isArchived && <p className="text-xs">Archived</p>}
    </div>
    {links.length > 0 && <div className="flex-[2_1_14rem] text-sm" aria-label="Requirements"><p className="text-xs text-fg-muted mb-1">Requirements</p><ul className="space-y-2">{links.map(link => <li key={link.requirementId}><Link className="text-accent-text underline" to={`/recruiter/workspace/requirements/${link.requirementId}`} state={{from}}>{link.requirement?.req_id_display || 'Historical requirement'}</Link><span className="ml-2">{link.stage}</span>{link.requirement?.status !== 'open' && <span className="ml-2 text-xs text-fg-muted">({link.requirement?.status || 'Unavailable'})</span>}</li>)}</ul></div>}
    <div className="flex flex-wrap gap-3 text-sm">
      {row.needle_resume_id && <button className="underline" onClick={() => openCandidateResume(row.id, row.needle_resume_id).catch(e => onError(e.message))}>View CV</button>}
      {canEdit && !row.isArchived && <button className="underline" aria-label={`Edit ${row.name}`} onClick={() => onEdit(row)}>Edit</button>}
      {canAttach && !row.isArchived && <button className="workspace-action-button workspace-action-button--secondary disabled:opacity-50" disabled={!row.needle_resume_id} title={!row.needle_resume_id ? 'Add and review a CV before attaching.' : undefined} onClick={() => onAttach(row)}>Attach to requirement</button>}
    </div>
  </article>
}

export default function CandidateDirectoryRows({ rows, attached, showAllLinks, fleet, filter, history, ...actions }) {
  if (!attached) return <div className="rounded-xl border border-line overflow-hidden">{rows.map(row => <CandidateRow key={`${row.isDraft ? 'draft' : 'candidate'}:${row.id}`} row={row} links={showAllLinks ? row.attachedRequirements : []} {...actions}/>)}</div>
  const groups = groupCandidateAttachments(rows, fleet.companies, fleet.ships, filter, history)
  return <div className="space-y-5" aria-label="Candidates by company and ship">{groups.map(company => <details key={company.id} open className="overflow-hidden rounded-xl border border-line">
    <summary className="cursor-pointer bg-accent-soft text-accent-text px-4 py-3 font-semibold"><Building2 className="inline h-4 w-4 mr-2"/>Company · {company.name}</summary>
    {company.ships.map(ship => <details key={ship.id} open className="border-t border-line">
      <summary className="cursor-pointer bg-raised px-4 py-3 font-medium"><Ship className="inline h-4 w-4 mr-2"/>Ship · {ship.name}</summary>
      {ship.candidates.map(({row,links}) => <CandidateRow key={row.id} row={row} links={links} {...actions}/>)}
    </details>)}
  </details>)}</div>
}
