import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StickyNote } from 'lucide-react'
import { workStage } from '../../utils/recruitmentWorkspace'
import { groupCandidateAttachments, resumeReadiness } from '../../utils/candidateDirectory'
import { dateCell, displayRankName, recordDisplayId } from '../../utils/directoryDisplay'
import { openCandidateResume } from '../../services/needleIntegrationService'
import DirectoryNotes from './DirectoryNotes'
import GroupedDirectoryTable from './GroupedDirectoryTable'

const INTERACTIVE = 'a,button,input,select,textarea,summary,label'

export function CandidateRow({ row, links = [], showRequirements = false, number, from, canEdit, canAddNotes, onEdit, onError, onNotes }) {
  const navigate = useNavigate()
  const open = row.isDraft ? null : `/recruiter/workspace/prospects/${row.id}`
  return <tr className={open ? 'cursor-pointer hover:bg-raised' : ''} onClick={event => { if (open && !event.target.closest(INTERACTIVE)) navigate(open, { state: { from } }) }}>
    <td>{number}</td>
    <td>{recordDisplayId(row, row.isDraft ? 'Draft' : '—')}</td>
    <td className="font-medium">{open ? <Link className="text-accent-text underline" to={open} state={{from}}>{row.name}</Link>
      : canEdit && !row.isArchived ? <button className="text-left text-accent-text underline" aria-label={`Edit ${row.name || 'unnamed candidate'}`} title="No CV yet: edit details" onClick={() => onEdit(row)}>{row.name || 'Unnamed candidate'}</button>
      : row.name || 'Unnamed candidate'}</td>
    <td><span className="block truncate" title={row.email || undefined}>{row.email || '—'}</span></td>
    <td className="tracker-cell--nowrap">{row.telephone || '—'}</td>
    <td>{displayRankName(row.rankName) || '—'}</td>
    <td>{row.vesselTypeName || '—'}</td>
    <td>{row.needle_resume_id
      ? <button className="tracker-pill bg-accent-soft text-accent-text" title="View CV" aria-label={`View CV for ${row.name}`} onClick={() => openCandidateResume(row.id, row.needle_resume_id).catch(error => onError(error.message))}>{resumeReadiness(row.cvStatus).label}</button>
      : <span className="tracker-pill bg-warning-soft text-warning">CV missing</span>}
      {row.isArchived && <span className="block text-xs">Archived</span>}</td>
    {showRequirements && <td><ul className="space-y-1">{links.length ? links.map(link => <li key={link.requirementId}><Link className="text-accent-text underline" to={`/recruiter/workspace/requirements/${link.requirementId}`} state={{from}}>{recordDisplayId(link.requirement, link.requirement?.req_id_display || 'Historical requirement')}</Link>{link.isCase
      ? <Link className="ml-2 text-xs underline" to={`/recruiter/recruitment?case=${link.id}`} title="Open recruitment" aria-label={`Open recruitment: ${workStage(link.status)}`}>{workStage(link.status)}</Link>
      : <span className="ml-2 text-xs">{link.stage}</span>}</li>) : <li>—</li>}</ul></td>}
    <td>{dateCell(row.updated_at || row.created_at)}</td>
    <td><button className="relative inline-flex h-8 w-8 items-center justify-center rounded-control text-accent-text hover:bg-raised" title={row.latestNote || (canAddNotes ? 'Add note' : 'View notes')} aria-label={row.latestNote ? `Notes for ${row.name}` : canAddNotes ? `Add note for ${row.name}` : `View notes for ${row.name}`} onClick={() => onNotes(row)}>
      <StickyNote aria-hidden="true" className="h-4 w-4" />
      {row.latestNote && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-fill" />}
    </button></td>
  </tr>
}

export default function CandidateDirectoryRows({ rows, attached, showAllLinks, fleet, filter, history, canAddNotes, onNotesSaved, ...actions }) {
  const [noteRow, setNoteRow] = useState(null)
  const withRequirements = attached || showAllLinks
  const header = ['S.No.','ID','Candidate','Email','Phone','Rank','Vessel type','CV',...(withRequirements ? ['Requirement'] : []),'Updated','Notes']
  const colWidths = withRequirements ? [3, 8, 12, 12, 10, 10, 9, 10, 12, 8, 6] : [4, 9, 16, 15, 12, 11, 10, 10, 8, 5]
  const groups = attached ? groupCandidateAttachments(rows, fleet.companies, fleet.ships, filter, history).map(company => ({ ...company, count: new Set(company.ships.flatMap(ship => ship.candidates.map(candidate => candidate.row.id))).size })) : []
  return <>
    <GroupedDirectoryTable label="Candidates by company and ship" groups={groups} columns={header} getShipRows={ship => ship.candidates} renderRows={attached
      ? (candidates, start) => candidates.map(({row,links}, index) => <CandidateRow key={row.id} row={row} links={links} showRequirements number={start + index + 1} canAddNotes={canAddNotes} onNotes={setNoteRow} {...actions}/>)
      : (candidates, start) => candidates.map((row, index) => <CandidateRow key={`${row.isDraft ? 'draft' : 'candidate'}:${row.id}`} row={row} links={showAllLinks ? row.attachedRequirements : []} showRequirements={showAllLinks} number={start + index + 1} canAddNotes={canAddNotes} onNotes={setNoteRow} {...actions}/>)} ungroupedRows={attached ? [] : rows} colWidths={colWidths} tableClassName={`candidate-directory-table ${withRequirements ? 'candidate-directory-table--with-requirements' : ''}`} />
    {noteRow && <DirectoryNotes kind={noteRow.isDraft ? 'draft' : 'candidate'} id={noteRow.id} label={recordDisplayId(noteRow, noteRow.name)} canAdd={canAddNotes && !noteRow.isArchived} onClose={() => setNoteRow(null)} onSaved={onNotesSaved} />}
  </>
}
