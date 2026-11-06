import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { needleIntegration, openCandidateResume, uploadResume, saveResumeCandidate, normalizeResumePhone } from '../../services/needleIntegrationService'

export default function CandidateResumePanel({ candidate, countries, permissions, onChanged }) {
  const [resumes, setResumes] = useState([])
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
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
          try { const status = await needleIntegration({ action: 'status', prospect_id: candidate.id, resume_id: row.resume_id }); return { ...row, needle_resume_registry: { ...row.needle_resume_registry, ...status } } }
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
  const missing = [['telephone','phone'],['email','email'],['dob','date of birth'],['nationality_id','nationality']].filter(([key]) => !candidate[key]).map(([,label]) => label)
  return <section className="recruiter-panel space-y-4 p-6" aria-label="Résumé and contact details">
    <h2 className="text-lg font-semibold">Résumé and contact completeness</h2>
    {missing.length > 0 && <p className="text-sm text-warning">Before progressing past contacted, complete: {missing.join(', ')}.</p>}
    {!resumes.length && <p className="text-sm text-warning">Résumé missing. This older candidate remains visible; upload the résumé when available.</p>}
    {resumes.map(row => <div key={row.resume_id} className="rounded-lg border border-line p-3">
      <button className="underline" disabled={busy} onClick={() => perform(() => openCandidateResume(candidate.id, row.resume_id))}>View résumé</button>
      <p className="mt-1 text-xs text-fg-secondary">{row.needle_resume_registry?.filename || 'Résumé'} · {row.statusUnavailable ? 'Status refresh unavailable' : row.needle_resume_registry?.review_required ? 'Needs operator review' : row.needle_resume_registry?.status || 'Status unavailable'} · {row.source === 'holmes_upload' ? 'Holmes upload' : 'Needle search'} · Linked {new Date(row.linked_at).toLocaleString()}</p>
      {row.needle_resume_registry?.status === 'failed' && <p className="text-sm text-warning">Couldn’t read or qualify this résumé. The original is retained; complete the details manually while the operator reviews it.</p>}
      <p className="break-all text-xs text-fg-muted">Engine: {row.engine_version || 'Not recorded'} · Facts: {row.facts_revision || 'Not recorded'}{row.stage_id ? ` · Search stage: ${row.stage_id}` : ''}</p>
    </div>)}
    {canEdit && permissions.includes('create_prospects') && <label className="block text-sm">Add résumé PDF (keeps earlier versions)
      <input className="mt-2 block max-w-full" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; if (!file) return
        perform(async () => { const resume = await uploadResume(file); await saveResumeCandidate(resume, {}, { linkTo: candidate.id }); setRevision(current => current + 1); onChanged?.() })
      }} />
    </label>}
    {canEdit && !editing && <button className="workspace-action-button workspace-action-button--secondary" onClick={() => { setFields({ name: candidate.name || '', email: candidate.email || '', telephone: candidate.telephone || '', dob: candidate.dob || '', nationality_id: candidate.nationality_id || '' }); setEditing(true) }}>Edit contact details</button>}
    {editing && <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); perform(async () => {
        const telephone = normalizeResumePhone(fields.telephone)
        if (fields.telephone.trim() && !telephone) throw new Error('Enter a phone number with its country code.')
        const { error: failure } = await supabase.rpc('update_resume_candidate_contacts', { p_id: candidate.id, p_expected_version: candidate.version, p_fields: { ...fields, telephone } })
        if (failure) throw failure
        setEditing(false); onChanged?.()
      })
    }}>
      <div className="grid gap-3 sm:grid-cols-2">{[['name','Name','text'],['email','Email','email'],['telephone','Phone with country code','tel'],['dob','Date of birth','date']].map(([key,label,type]) => <label className="block text-sm" key={key}>{label}<input className="mt-1 w-full rounded border border-line bg-surface p-2" type={type} required={key === 'name'} value={fields[key] || ''} onChange={event => setFields(prev => ({ ...prev, [key]: event.target.value }))} /></label>)}
        <label className="block text-sm">Nationality<select className="mt-1 w-full rounded border border-line bg-surface p-2" value={fields.nationality_id || ''} onChange={event => setFields(prev => ({ ...prev, nationality_id: event.target.value }))}><option value="">Not provided</option>{Object.entries(countries).map(([id,row]) => <option key={id} value={id}>{typeof row === 'string' ? row : row.name}</option>)}</select></label>
      </div>
      <button disabled={busy} className="workspace-action-button workspace-action-button--primary">Save contact details</button> <button type="button" className="underline" onClick={() => setEditing(false)}>Cancel</button>
    </form>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </section>
}
