import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ResumeSuggestionReview from './ResumeSuggestionReview'
import { resumeIntakeEnabled, RESUME_INTAKE_HOLD } from '../../lib/resumeIntake'
import { candidateResumeStatus, openCandidateResume, uploadResume, saveResumeCandidate } from '../../services/needleIntegrationService'
import { dateTimeCell } from '../../utils/directoryDisplay'

export default function CandidateResumePanel({ candidate, permissions, onChanged }) {
  const [resumes, setResumes] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [pendingResume,setPendingResume]=useState(null)
  const [reviewed,setReviewed]=useState(false)
  const canEdit = permissions.includes('edit_prospects')
  useEffect(() => {
    let active = true
    supabase.from('prospect_resumes').select('resume_id,source,stage_id,engine_version,facts_revision,linked_at,needle_resume_registry(filename,status)').eq('prospect_id', candidate.id).order('linked_at', { ascending: false })
      .then(async ({ data, error: failure }) => {
        if (!active) return
        setResumes(data || [])
        if (failure) { setError('Résumé links unavailable'); return }
        // Refresh snapshots from Needle without sending its facts to this page.
        const rows = await Promise.all((data || []).map(async row => {
          try { const status = await candidateResumeStatus(candidate.id,row.resume_id); return { ...row, needle_resume_registry: { ...row.needle_resume_registry, ...status } } }
          catch { return { ...row, statusUnavailable: true } }
        }))
        if (active) setResumes(rows)
      })
    return () => { active = false }
  }, [candidate.id, candidate.updated_at, candidate.needle_resume_id, revision])
  const perform = async fn => {
    setBusy(true); setError('')
    try { await fn() } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  return <section className="recruiter-panel space-y-4 p-6" aria-label="CV">
    <h2 className="text-lg font-semibold">CV</h2>
    {!resumes.length && <p className="text-sm text-warning">No CV yet.</p>}
    {resumes.map(row => <div key={row.resume_id} className="rounded-lg border border-line p-3">
      <button className="underline" disabled={busy} onClick={() => perform(() => openCandidateResume(candidate.id, row.resume_id))}>View CV</button>
      {row.needle_resume_registry?.platform&&<p className="text-sm">Storage: {row.needle_resume_registry.storage_status} · Basic extraction: {row.needle_resume_registry.basic_extraction_status?.replaceAll('_',' ')} · Indexing: {row.needle_resume_registry.indexing_status?.replaceAll('_',' ')}</p>}
      <p className="mt-1 text-xs text-fg-secondary">{row.needle_resume_registry?.filename || 'Résumé'} · {row.statusUnavailable ? 'Status refresh unavailable' : row.needle_resume_registry?.review_required ? 'Needs operator review' : row.needle_resume_registry?.status || 'Status unavailable'} · {row.source === 'holmes_upload' ? 'Holmes upload' : 'Needle search'} · Linked {dateTimeCell(row.linked_at)}</p>
      {row.needle_resume_registry?.status === 'failed' && <p className="text-sm text-warning">Couldn’t read or qualify this résumé. The original is retained; complete the details manually while the operator reviews it.</p>}
      <details className="break-all text-xs text-fg-muted"><summary className="cursor-pointer">Technical details</summary><p className="mt-1">Engine: {row.engine_version || 'Not recorded'} · Facts: {row.facts_revision || 'Not recorded'}{row.stage_id ? ` · Search stage: ${row.stage_id}` : ''}</p></details>
    </div>)}
    {canEdit && !resumeIntakeEnabled() && <p role="note" className="text-sm text-warning">{RESUME_INTAKE_HOLD}</p>}
    {canEdit && resumeIntakeEnabled() && permissions.includes('create_prospects') && <label className="block text-sm">Upload CV (PDF)
      <input className="mt-2 block max-w-full" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; if (!file) return
        perform(async () => { setPendingResume(null);setReviewed(false);const resume=await uploadResume(file);setPendingResume(resume) })
      }} />
    </label>}
    {pendingResume && resumeIntakeEnabled() && <section className="space-y-3 rounded border border-line p-3" aria-label="Review new résumé version">
      <ResumeSuggestionReview resume={pendingResume}/>
      <p className="text-sm">Link this original to {candidate.name}? Confirmed candidate fields will be retained.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the original and confirm it belongs to this candidate.</label>
      <button className="workspace-action-button workspace-action-button--primary" disabled={busy||!reviewed} onClick={()=>perform(async()=>{await saveResumeCandidate(pendingResume,{}, {linkTo:candidate.id});setPendingResume(null);setReviewed(false);setRevision(n=>n+1);onChanged?.()})}>Link reviewed résumé</button>
      <button className="ml-3 underline" disabled={busy} onClick={()=>{setPendingResume(null);setReviewed(false)}}>Leave in intake queue</button>
    </section>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
