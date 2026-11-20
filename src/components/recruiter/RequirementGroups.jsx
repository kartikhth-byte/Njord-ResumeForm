import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { groupRequirements } from '../../utils/requirementGroups'
import { requirementMatchBlocker } from '../../utils/requirementMatch'
import { getStatusMeta, REQUIREMENT_STATUS_META } from '../../pages/recruiterDashboardUtils'
import { dateCell, displayRankName, recordDisplayId } from '../../utils/directoryDisplay'
import DirectoryNotes from './DirectoryNotes'
import GroupedDirectoryTable from './GroupedDirectoryTable'

export default function RequirementGroups({ rows, fleet, data, canMatch, canAddNotes, onMatch, onNotesSaved, matchButtons, from }) {
  const groups = useMemo(() => groupRequirements(rows, fleet.companies, fleet.ships), [rows, fleet.companies, fleet.ships])
  const [noteRow, setNoteRow] = useState(null)
  const renderRows = (rows, start) => rows.map((row, index) => {
            const status = getStatusMeta(REQUIREMENT_STATUS_META, row.status)
            const blocker = requirementMatchBlocker(row)
            const candidateCount = new Set(data.cases.filter(item => item.requirement_id === row.id).map(item => item.prospect_id)).size
            return <tr key={row.id}>
              <td>{start + index + 1}</td>
              <td><Link className="text-accent-text underline" to={`/recruiter/workspace/requirements/${row.id}`} state={{from}}>{recordDisplayId(row, row.reqId)}</Link></td>
              <td>{displayRankName(row.rankName) || '—'}<span className="block text-xs text-fg-muted">{row.vesselTypeName}</span></td>
              <td><span className="block whitespace-nowrap" title="Crew joined out of positions required">{row.joinedCount} of {row.positions_required ?? '—'} filled</span>{data.casesAvailable && <Link className="block whitespace-nowrap text-xs text-accent-text underline" title="Candidates attached to this requirement at any stage" to={`/recruiter/candidates?view=all&requirement=${encodeURIComponent(row.id)}`}>{candidateCount} in pipeline</Link>}</td>
              <td><span className={`tracker-pill ${status.className}`}>{status.label}</span>{row.isArchived && <span className="ml-1 text-xs">Archived</span>}</td>
              <td>{row.recruiterName}</td><td>{dateCell(row.created_at)}</td><td>{dateCell(row.updated_at)}</td>
              <td><button className="text-accent-text underline" onClick={() => setNoteRow(row)}>{row.latestRemark ? <span title={row.latestRemark}>{row.latestRemark.slice(0, 36)}{row.latestRemark.length > 36 ? '…' : ''}</span> : canAddNotes ? 'Add note' : 'View notes'}</button></td>
              <td>{canMatch ? <div className="flex flex-col items-start gap-1"><button ref={element => { if (element) matchButtons.current.set(row.id, element); else matchButtons.current.delete(row.id) }} className="whitespace-nowrap text-accent-text underline disabled:opacity-50" aria-label={`Match Resume for ${row.reqId}`} disabled={!!blocker} title={blocker || undefined} onClick={() => onMatch(row)}>Match Resume</button>{blocker && <span className="text-xs text-fg-muted">{blocker}</span>}</div> : '—'}</td>
            </tr>
  })
  return <>
    <GroupedDirectoryTable label="Requirements by company and ship" groups={groups} columns={['S.No.','Requirement ID','Rank','Positions','Status','Recruiter','Created','Modified','Notes','Actions']} renderRows={renderRows} colWidths={[4, 11, 14, 10, 9, 12, 8, 8, 12, 12]} tableClassName="directory-table--fixed min-w-[1350px]" />
    {noteRow && <DirectoryNotes kind="requirement" id={noteRow.id} label={recordDisplayId(noteRow, noteRow.reqId)} canAdd={canAddNotes} onClose={() => setNoteRow(null)} onSaved={onNotesSaved} />}
  </>
}
