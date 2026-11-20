import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StickyNote } from 'lucide-react'
import { workStage } from '../../utils/recruitmentWorkspace'
import { groupCandidateAttachments, resumeReadiness } from '../../utils/candidateDirectory'
import { dateCell, displayRankName, recordDisplayId } from '../../utils/directoryDisplay'
import { openCandidateResume } from '../../services/needleIntegrationService'
import { resumeIntakeEnabled } from '../../lib/resumeIntake'
import DirectoryNotes from './DirectoryNotes'
import GroupedDirectoryTable from './GroupedDirectoryTable'

const INTERACTIVE = 'a,button,input,select,textarea,summary,label'

// One clear action per row; everything else lives on the candidate page.
function NextStep({ row, from, canEdit, canAttach, onEdit, onAttach }) {
  if (row.isArchived) return <span className="text-fg-muted">—</span>
  if (row.isDraft) return canEdit ? <button className="workspace-action-button workspace-action-button--secondary whitespace-nowrap" aria-label={`Edit ${row.name || 'unnamed candidate'}`} onClick={() => onEdit(row)}>Complete</button> : <span className="text-fg-muted">—</span>
  if (row.needle_resume_id) return canAttach ? <button className="workspace-action-button workspace-action-button--primary whitespace-nowrap" aria-label={`Attach ${row.name} to requirement`} onClick={() => onAttach(row)}>Attach</button> : <span className="text-fg-muted">—</span>
  if (canEdit && resumeIntakeEnabled()) return <Link className="workspace-action-button workspace-action-button--secondary whitespace-nowrap" to={`/recruiter/workspace/prospects/${row.id}`} state={{from}} aria-label={`Add CV for ${row.name}`}>Add CV</Link>
  return <span className="text-fg-muted">—</span>
}

export function CandidateRow({ row, links = [], showRequirements = false, from, canEdit, canAttach, canAddNotes, onEdit, onAttach, onError, onNotes }) {
  const navigate = useNavigate()
  const open = row.isDraft ? null : `/recruiter/workspace/prospects/${row.id}`
  const contact = row.telephone || row.email
  return <tr className={open ? 'cursor-pointer hover:bg-raised' : ''} onClick={event => { if (open && !event.target.closest(INTERACTIVE)) navigate(open, { state: { from } }) }}>
    <td>
      <div className="font-medium">{open ? <Link className="text-accent-text underline" to={open} state={{from}}>{row.name}</Link> : row.name || 'Unnamed candidate'}</div>
      <span className="block max-w-full truncate text-xs text-fg-secondary" title={contact || undefined}>{contact || 'No phone or email'}</span>
      {(row.display_id || row.isDraft) && <span className="block text-xs text-fg-muted tracker-cell--nowrap">{recordDisplayId(row, 'Draft')}</span>}
    </td>
    <td>{displayRankName(row.rankName) || '—'}<span className="block text-xs text-fg-muted">{row.vesselTypeName || '—'}</span></td>
    <td>{row.needle_resume_id
      ? <button className="tracker-pill bg-accent-soft text-accent-text" title="View CV" aria-label={`View CV for ${row.name}`} onClick={() => openCandidateResume(row.id, row.needle_resume_id).catch(error => onError(error.message))}>{resumeReadiness(row.cvStatus).label}</button>
      : <span className="tracker-pill bg-warning-soft text-warning">CV missing</span>}
      {row.isArchived && <span className="block text-xs">Archived</span>}</td>
    {showRequirements && <td><ul className="space-y-1">{links.length ? links.map(link => <li key={link.requirementId}><Link className="text-accent-text underline" to={`/recruiter/workspace/requirements/${link.requirementId}`} state={{from}}>{recordDisplayId(link.requirement, link.requirement?.req_id_display || 'Historical requirement')}</Link>{link.isCase
      ? <Link className="ml-2 text-xs underline" to={`/recruiter/recruitment?case=${link.id}`} title="Open recruitment" aria-label={`Open recruitment: ${workStage(link.status)}`}>{workStage(link.status)}</Link>
      : <span className="ml-2 text-xs">{link.stage}</span>}</li>) : <li>—</li>}</ul></td>}
    <td className="tracker-cell--nowrap">{dateCell(row.updated_at || row.created_at)}</td>
    <td><button className="flex max-w-full items-center gap-1 text-left text-accent-text underline" aria-label={row.latestNote ? `Notes for ${row.name}` : canAddNotes ? `Add note for ${row.name}` : `View notes for ${row.name}`} onClick={() => onNotes(row)}>
      <StickyNote aria-hidden="true" className="h-4 w-4 shrink-0" />
      {row.latestNote ? <span className="truncate" title={row.latestNote}>{row.latestNote}</span> : <span>{canAddNotes ? 'Add' : 'View'}</span>}
    </button></td>
    <td><NextStep row={row} from={from} canEdit={canEdit} canAttach={canAttach} onEdit={onEdit} onAttach={onAttach} /></td>
  </tr>
}

export default function CandidateDirectoryRows({ rows, attached, showAllLinks, fleet, filter, history, canAddNotes, onNotesSaved, ...actions }) {
  const [noteRow, setNoteRow] = useState(null)
  const withRequirements = attached || showAllLinks
  const header = ['Candidate','Rank','CV',...(withRequirements ? ['Requirement'] : []),'Updated','Notes','Next step']
  const colWidths = withRequirements ? [25, 16, 12, 18, 10, 9, 10] : [32, 20, 13, 12, 12, 11]
  const groups = attached ? groupCandidateAttachments(rows, fleet.companies, fleet.ships, filter, history).map(company => ({ ...company, count: new Set(company.ships.flatMap(ship => ship.candidates.map(candidate => candidate.row.id))).size })) : []
  return <>
    <GroupedDirectoryTable label="Candidates by company and ship" groups={groups} columns={header} getShipRows={ship => ship.candidates} renderRows={attached
      ? candidates => candidates.map(({row,links}) => <CandidateRow key={row.id} row={row} links={links} showRequirements canAddNotes={canAddNotes} onNotes={setNoteRow} {...actions}/>)
      : candidates => candidates.map(row => <CandidateRow key={`${row.isDraft ? 'draft' : 'candidate'}:${row.id}`} row={row} links={showAllLinks ? row.attachedRequirements : []} showRequirements={showAllLinks} canAddNotes={canAddNotes} onNotes={setNoteRow} {...actions}/>)} ungroupedRows={attached ? [] : rows} colWidths={colWidths} tableClassName={`candidate-directory-table ${withRequirements ? 'candidate-directory-table--with-requirements' : ''}`} />
    {noteRow && <DirectoryNotes kind={noteRow.isDraft ? 'draft' : 'candidate'} id={noteRow.id} label={recordDisplayId(noteRow, noteRow.name)} canAdd={canAddNotes && !noteRow.isArchived} onClose={() => setNoteRow(null)} onSaved={onNotesSaved} />}
  </>
}
