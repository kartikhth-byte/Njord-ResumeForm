import { useEffect, useState } from 'react'
import RecordFormDialog from './RecordFormDialog'
import { candidateResumeStatus, openCandidateResume } from '../../services/needleIntegrationService'
import { attachCandidateToRequirement } from '../../services/recruiterRecordService'
import { attachmentIsActive, resumeReadiness } from '../../utils/candidateDirectory'
import { requirementMatchBlocker } from '../../utils/requirementMatch'

export default function CandidateAttachmentDialog({ candidate, requirements, fleet, onSaved, onClose }) {
  const [selected, setSelected] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    candidateResumeStatus(candidate.id, candidate.needle_resume_id).then(value => { if (active) setStatus(value) }).catch(() => { if (active) setError('CV availability could not be checked. Close and try again.') }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [candidate.id, candidate.needle_resume_id])
  const linked = new Set(candidate.attachedRequirements.filter(attachmentIsActive).map(link => link.requirementId))
  const eligible = requirements.filter(r => !requirementMatchBlocker(r) && !linked.has(r.id) &&
    fleet.companies.some(c => c.id === r.company_id && !c.archived_at) && fleet.ships.some(s => s.id === r.ship_id && s.company_id === r.company_id && !s.archived_at))
  const requirementLabel = r => `${fleet.companies.find(c => c.id === r.company_id)?.name || 'Company'} · ${fleet.ships.find(s => s.id === r.ship_id)?.name || 'Ship'} · ${r.display_id || r.req_id_display}`
  const visible = eligible.filter(r => r.id === selected || requirementLabel(r).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const readiness = resumeReadiness(status)
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (!eligible.some(r => r.id === selected)) throw Error('Choose an open requirement.')
      if (!resumeReadiness(await candidateResumeStatus(candidate.id, candidate.needle_resume_id)).ready) throw Error('The CV is unavailable or needs review. Attachment was not saved.')
      await attachCandidateToRequirement(candidate.id, selected)
      onSaved('Candidate attached to requirement.')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <RecordFormDialog title={`Attach ${candidate.name}`} busy={busy} onClose={onClose}>
    <form onSubmit={save} className="p-5 space-y-4">
      <p role="status">{checking ? 'Checking CV…' : readiness.label}</p>
      <button type="button" className="underline text-sm" disabled={busy} onClick={() => openCandidateResume(candidate.id, candidate.needle_resume_id).catch(f => setError(f.message))}>View CV</button>
      {candidate.attachedRequirements.length > 0 && <p className="text-sm text-fg-secondary">Previous attachments: {candidate.attachedRequirements.map(link => `${link.requirement?.req_id_display || 'Requirement'} (${link.stage})`).join(', ')}</p>}
      <div className="text-sm"><label htmlFor="attachment-requirement-search">Open requirement</label><input id="attachment-requirement-search" type="search" className="mt-2 w-full rounded-control border border-line-input bg-surface p-3" placeholder="Search company, ship or requirement ID" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Open requirement" className="mt-2 w-full rounded-control border border-line-input bg-surface p-3" required value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setQuery('') }}>
        <option value="">Choose company · ship · requirement</option>
        {visible.map(r => <option key={r.id} value={r.id}>{requirementLabel(r)}</option>)}
      </select></div>
      {!eligible.length && <p>No eligible open requirements. Existing active attachments are excluded.</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="flex gap-3"><button disabled={busy || checking || !readiness.ready || !selected} className="workspace-action-button workspace-action-button--primary">Attach</button><button type="button" disabled={busy} className="workspace-action-button workspace-action-button--secondary" onClick={onClose}>Cancel</button></div>
    </form>
  </RecordFormDialog>
}
