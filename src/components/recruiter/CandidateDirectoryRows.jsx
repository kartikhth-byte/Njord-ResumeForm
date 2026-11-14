import { useState } from 'react'
import { Link } from 'react-router-dom'
import { workStage } from '../../utils/recruitmentWorkspace'
import { groupCandidateAttachments, resumeReadiness } from '../../utils/candidateDirectory'
import { dateCell, recordDisplayId } from '../../utils/directoryDisplay'
import { openCandidateResume } from '../../services/needleIntegrationService'
import DirectoryNotes from './DirectoryNotes'

export function CandidateRow({ row, links = [], showRequirements = false, number, from, canEdit, canAttach, canAddNotes, onEdit, onAttach, onError, onNotes }) {
  return <tr>
    <td>{number}</td>
    <td>{recordDisplayId(row, row.isDraft ? 'Draft' : '')}</td>
    <td className="min-w-44"><div className="font-medium">{row.isDraft ? row.name || 'Unnamed candidate' : <Link className="text-accent-text underline" to={`/recruiter/workspace/prospects/${row.id}`} state={{from}}>{row.name}</Link>}</div><span className="text-xs text-fg-muted">{row.email || row.telephone || 'Contact details missing'}</span></td>
    <td>{row.rankName || '—'}<span className="block text-xs text-fg-muted">{row.vesselTypeName || '—'}</span></td>
    <td><span className={`tracker-pill ${row.needle_resume_id ? 'bg-accent-soft text-accent-text' : 'bg-warning-soft text-warning'}`}>{row.needle_resume_id ? resumeReadiness(row.cvStatus).label : 'CV missing'}</span>{row.isArchived && <span className="block text-xs">Archived</span>}</td>
    {showRequirements && <td><ul className="space-y-1">{links.length ? links.map(link => <li key={link.requirementId}><Link className="text-accent-text underline" to={`/recruiter/workspace/requirements/${link.requirementId}`} state={{from}}>{recordDisplayId(link.requirement, link.requirement?.req_id_display || 'Historical requirement')}</Link><span className="ml-2 text-xs">{link.isCase ? workStage(link.status) : link.stage}</span></li>) : <li>—</li>}</ul></td>}
    <td>{dateCell(row.created_at)}</td><td>{dateCell(row.updated_at)}</td>
    <td><button className="text-accent-text underline" onClick={() => onNotes(row)}>{row.latestNote ? <span title={row.latestNote}>{row.latestNote.slice(0, 32)}{row.latestNote.length > 32 ? '…' : ''}</span> : canAddNotes ? 'Add note' : 'View notes'}</button></td>
    <td><details className="relative"><summary className="cursor-pointer text-accent-text">More</summary><div className="flex flex-col items-start gap-2 whitespace-nowrap rounded-control border border-line bg-surface p-2 shadow-lg">
      {!row.isDraft && <Link className="underline" to={`/recruiter/workspace/prospects/${row.id}`} state={{from}}>Open candidate</Link>}
      {links.filter(link => link.isCase).map(link => <Link key={link.id} className="underline" to={`/recruiter/recruitment?case=${link.id}`}>Open recruitment · {recordDisplayId(link.requirement, link.requirement?.req_id_display)}</Link>)}
      {row.needle_resume_id && <button className="underline" onClick={() => openCandidateResume(row.id, row.needle_resume_id).catch(error => onError(error.message))}>View CV</button>}
      {canEdit && !row.isArchived && <button className="underline" aria-label={`Edit ${row.name}`} onClick={() => onEdit(row)}>Edit</button>}
      {canAttach && !row.isArchived && <button className="underline disabled:opacity-50" disabled={!row.needle_resume_id} title={!row.needle_resume_id ? 'Add and review a CV before attaching.' : undefined} onClick={() => onAttach(row)}>Attach to requirement</button>}
    </div></details></td>
  </tr>
}

export default function CandidateDirectoryRows({ rows, attached, showAllLinks, fleet, filter, history, canAddNotes, onNotesSaved, ...actions }) {
  const [noteRow, setNoteRow] = useState(null)
  const withRequirements = attached || showAllLinks
  const header = ['S.No.','Candidate ID','Candidate','Rank','CV',...(withRequirements ? ['Requirements'] : []),'Created','Modified','Notes','Actions']
  let serial = 0
  const groups = attached ? groupCandidateAttachments(rows, fleet.companies, fleet.ships, filter, history) : []
  return <>
    <div className="tracker-table-wrap" aria-label="Candidates"><table className="tracker-table min-w-[1200px]">
      <thead><tr>{header.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{attached ? groups.flatMap(company => [
        <tr key={`company:${company.id}`} className="bg-accent-soft"><td colSpan={header.length} className="font-semibold">{company.name}</td></tr>,
        ...company.ships.flatMap(ship => [
          <tr key={`ship:${ship.id}`} className="bg-raised"><td colSpan={header.length} className="font-medium">{ship.name}</td></tr>,
          ...ship.candidates.map(({row,links}) => <CandidateRow key={`${ship.id}:${row.id}`} row={row} links={links} showRequirements number={++serial} canAddNotes={canAddNotes} onNotes={setNoteRow} {...actions}/>)
        ])
      ]) : rows.map(row => <CandidateRow key={`${row.isDraft ? 'draft' : 'candidate'}:${row.id}`} row={row} links={showAllLinks ? row.attachedRequirements : []} showRequirements={showAllLinks} number={++serial} canAddNotes={canAddNotes} onNotes={setNoteRow} {...actions}/>)}</tbody>
    </table></div>
    {noteRow && <DirectoryNotes kind={noteRow.isDraft ? 'draft' : 'candidate'} id={noteRow.id} label={recordDisplayId(noteRow, noteRow.name)} canAdd={canAddNotes && !noteRow.isArchived} onClose={() => setNoteRow(null)} onSaved={onNotesSaved} />}
  </>
}
