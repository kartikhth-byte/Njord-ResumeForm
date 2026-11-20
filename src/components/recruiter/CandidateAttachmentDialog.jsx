import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import RecordFormDialog from './RecordFormDialog'
import { candidateResumeStatus, openCandidateResume } from '../../services/needleIntegrationService'
import { attachCandidateToRequirement } from '../../services/recruiterRecordService'
import { attachmentIsActive, resumeReadiness } from '../../utils/candidateDirectory'
import { requirementMatchBlocker } from '../../utils/requirementMatch'
import { dateCell, displayRankName } from '../../utils/directoryDisplay'
import { resumeIntakeEnabled } from '../../lib/resumeIntake'

const nameOf = (rows, id) => rows?.find(row => row.id === id)?.name

// Requirements are shown as readable cards with the best fits first, so the
// recruiter never needs to remember a requirement ID.
export default function CandidateAttachmentDialog({ candidate, requirements, fleet, ranks = [], vesselTypes = [], requireCv = true, onSaved, onClose }) {
  const [selected, setSelected] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(requireCv)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasCv = !!candidate.needle_resume_id
  useEffect(() => {
    if (!requireCv) return undefined
    let active = true
    candidateResumeStatus(candidate.id, candidate.needle_resume_id).then(value => { if (active) setStatus(value) }).catch(() => { if (active) setError('Could not check the CV. Close and try again.') }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [candidate.id, candidate.needle_resume_id, requireCv])

  const cards = useMemo(() => {
    const linked = new Set((candidate.attachedRequirements || []).filter(attachmentIsActive).map(link => link.requirementId))
    return requirements
      .filter(r => !requirementMatchBlocker(r) && !linked.has(r.id) &&
        fleet.companies.some(c => c.id === r.company_id && !c.archived_at) && fleet.ships.some(s => s.id === r.ship_id && s.company_id === r.company_id && !s.archived_at))
      .map(r => {
        const rank = displayRankName(nameOf(ranks, r.rank_id)) || 'Rank not set'
        const vessel = nameOf(vesselTypes, r.vessel_type_id) || ''
        const ship = fleet.ships.find(s => s.id === r.ship_id)?.name || 'Ship'
        const company = fleet.companies.find(c => c.id === r.company_id)?.name || 'Company'
        const id = r.display_id || r.req_id_display || ''
        const fit = (r.rank_id && r.rank_id === candidate.rank_applied_for_id ? 2 : 0) + (r.vessel_type_id && r.vessel_type_id === candidate.vessel_type_id ? 1 : 0)
        return { r, rank, vessel, ship, company, id, fit, text: [rank, vessel, ship, company, id].join(' ').toLocaleLowerCase() }
      })
      .sort((a, b) => b.fit - a.fit || String(b.r.date_opened || '').localeCompare(String(a.r.date_opened || '')))
  }, [requirements, candidate, fleet, ranks, vesselTypes])

  const term = query.trim().toLocaleLowerCase()
  const visible = cards.filter(card => card.r.id === selected || !term || card.text.includes(term))
  const best = visible.filter(card => card.fit >= 2)
  const others = visible.filter(card => card.fit < 2)
  // One clear best fit is picked for the recruiter.
  useEffect(() => {
    const top = cards.filter(card => card.fit >= 2)
    if (!selected && top.length === 1) setSelected(top[0].r.id)
  }, [cards, selected])

  const readiness = requireCv ? resumeReadiness(status) : { ready: true }
  const blockedByCv = requireCv && !checking && !readiness.ready
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (!cards.some(card => card.r.id === selected)) throw Error('Choose a requirement.')
      if (requireCv && !resumeReadiness(await candidateResumeStatus(candidate.id, candidate.needle_resume_id)).ready) throw Error('The CV is not ready. Nothing was saved.')
      await attachCandidateToRequirement(candidate.id, selected)
      onSaved('Candidate attached.')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const card = ({ r, rank, vessel, ship, company, id }) => <li key={r.id}>
    <label className={`flex cursor-pointer gap-3 rounded-control border p-3 ${selected === r.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-raised'}`}>
      <input type="radio" name="attach-requirement" className="mt-1" value={r.id} checked={selected === r.id} disabled={busy} onChange={() => setSelected(r.id)} aria-label={`${rank} – ${ship} (${company})`} />
      <span className="min-w-0">
        <span className="block font-semibold">{rank}{vessel && <span className="font-normal text-fg-secondary"> · {vessel}</span>}</span>
        <span className="block text-sm">{ship} – {company}</span>
        <span className="block text-xs text-fg-muted">Needs {r.positions_required ?? '—'} · Opened {dateCell(r.date_opened)}{id && ` · ${id}`}</span>
      </span>
    </label>
  </li>

  return <RecordFormDialog title={`Attach ${candidate.name}`} busy={busy} onClose={onClose}>
    <form onSubmit={save} className="space-y-4 p-5">
      {requireCv && <div className="flex flex-wrap items-center gap-3 text-sm">
        <p role="status">{checking ? 'Checking CV…' : readiness.label}</p>
        {hasCv && <button type="button" className="underline" disabled={busy} onClick={() => openCandidateResume(candidate.id, candidate.needle_resume_id).catch(f => setError(f.message))}>View CV</button>}
      </div>}
      {blockedByCv && <p className="rounded-control border border-warning-line bg-warning-soft p-3 text-sm text-warning">
        Add a CV before attaching.{resumeIntakeEnabled() && <> <Link className="underline" to={`/recruiter/workspace/prospects/${candidate.id}`}>Add CV</Link></>}
      </p>}
      <label className="block text-sm" htmlFor="attachment-requirement-search">Search
        <input id="attachment-requirement-search" type="search" className="mt-1 w-full rounded-control border border-line-input bg-surface p-3" placeholder="Rank, ship or company" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <fieldset className="max-h-[50vh] space-y-4 overflow-y-auto" aria-label="Open requirements">
        {best.length > 0 && <section><h3 className="mb-2 text-sm font-semibold">Best fit</h3><ul className="space-y-2">{best.map(card)}</ul></section>}
        {others.length > 0 && <section>{best.length > 0 && <h3 className="mb-2 text-sm font-semibold">Other open requirements</h3>}<ul className="space-y-2">{others.map(card)}</ul></section>}
        {!cards.length && <p className="text-sm">No open requirements to attach to.</p>}
        {cards.length > 0 && !visible.length && <p className="text-sm">Nothing matches “{query}”.</p>}
      </fieldset>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="flex gap-3"><button disabled={busy || checking || blockedByCv || !selected} className="workspace-action-button workspace-action-button--primary">Attach</button><button type="button" disabled={busy} className="workspace-action-button workspace-action-button--secondary" onClick={onClose}>Cancel</button></div>
    </form>
  </RecordFormDialog>
}
