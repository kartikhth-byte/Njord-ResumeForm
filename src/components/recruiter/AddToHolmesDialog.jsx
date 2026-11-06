import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { prepareResumes, normalizeResumePhone, withRequirementDefaults } from '../../services/needleIntegrationService'
import CandidateForm from './CandidateForm'

// Bulk additions are independently reviewed. A failed item never rolls back a
// successful item, and retrying the same evidence does not create another person.
export default function AddToHolmesDialog({ resumeIds, stageId, requirementId, onClose }) {
  const { user, permissions = [], role } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', resumes: [], ranks: [], vessels: [], countries: [], requirements: [] })
  const [index, setIndex] = useState(0)
  const [saved, setSaved] = useState({})
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => {
    let active = true
    Promise.all([prepareResumes(resumeIds, stageId),
      supabase.from('ranks').select('id,name').order('name'),
      supabase.from('vessel_types').select('id,name').order('name'),
      supabase.from('countries').select('id,name').order('name'),
      supabase.from('requirements').select('id,req_id_display,status,version,rank_id,vessel_type_id').eq('status', 'open').is('deleted_at', null).is('archived_at', null),
    ]).then(([resumes, ranks, vessels, countries, requirements]) => {
      if ([ranks, vessels, countries, requirements].some(result => result.error)) throw new Error('Candidate options unavailable')
      if (active) setState({ loading: false, error: '', resumes, ranks: ranks.data || [], vessels: vessels.data || [], countries: countries.data || [], requirements: requirements.data || [] })
    }).catch(error => { if (active) setState(prev => ({ ...prev, loading: false, error: error.message })) })
    return () => { active = false }
  }, [resumeIds, stageId])
  const resume = state.resumes[index]
  const prefill = resume?.prefill || {}
  const comparable = value => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\s+/g, ' ').trim()
  const lookup = (rows, raw) => rows.find(row => comparable(row.name) === comparable(raw))?.id || ''
  const requirementOptions = state.requirements.map(row => ({ value: row.id, label: row.req_id_display, version: row.version, rankId: row.rank_id, vesselTypeId: row.vessel_type_id }))
  const initial = resume ? withRequirementDefaults({ resume, name: prefill.full_name || '', email: prefill.email || '', telephone: normalizeResumePhone(prefill.phone),
    dob: /^\d{4}-\d{2}-\d{2}$/.test(prefill.dob || '') ? prefill.dob : '', nationalityId: lookup(state.countries, prefill.nationality),
    rankId: lookup(state.ranks, prefill.present_rank), requirementId: state.requirements.some(row => row.id === requirementId) ? requirementId : '',
    requirementVersion: state.requirements.find(row => row.id === requirementId)?.version,
  }, requirementOptions.find(row => row.value === requirementId)) : {}
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="add-holmes-title" onKeyDown={event => {
    if (event.key === 'Escape') onClose()
    if (event.key === 'Tab') {
      const nodes = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')]
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
    }
  }}>
    <section ref={ref} tabIndex={-1} className="mx-auto max-w-3xl rounded-2xl bg-surface p-4 sm:p-6">
      <div className="mb-4 flex justify-between gap-4"><h2 id="add-holmes-title" className="text-xl font-semibold">Add to Holmes</h2><button onClick={onClose} className="underline">Close</button></div>
      <p className="mb-4 text-sm text-fg-secondary">Review extracted details against the résumé. Nothing is sent to a candidate when you save.</p>
      {state.loading && <p role="status">Verifying résumé sources…</p>}
      {state.error && <p role="alert" className="text-danger">{state.error}</p>}
      {resume && <>
        <a className="mb-3 inline-block underline" href={`/ai/api/workspace/candidates/${resume.resume_id}/pdf`} target="_blank" rel="noreferrer">Open original résumé for review</a>
        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Selected résumés">{state.resumes.map((row, i) => <button key={row.resume_id} className="rounded border border-line px-3 py-1" aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}>{i + 1}{saved[row.resume_id] ? ' ✓' : ''}</button>)}</nav>
        {saved[resume.resume_id] ? <p role="status">Saved. <Link className="underline" to={`/recruiter/workspace/prospects/${saved[resume.resume_id]}`}>Open candidate</Link></p> : <>
          {prefill.phone && !initial.telephone && <p className="mb-3 text-sm text-warning">Source phone: {prefill.phone}. Enter its country code explicitly, or save using email.</p>}
          <CandidateForm key={resume.resume_id} initialForm={initial} allowUpload={false} ranks={state.ranks} vesselTypes={state.vessels}
            currentRecruiterId={user.id} canChooseRecruiter={false} canSave={permissions.includes('create_prospects') || role === 'Master Recruiter' || role === 'Recruiter'}
            canAttach={permissions.includes('edit_junction_status')} requirementOptions={requirementOptions}
            onSaved={(_message, result) => { setSaved(prev => ({ ...prev, [resume.resume_id]: result.id })); if (index < state.resumes.length - 1) setIndex(index + 1) }} onCancel={onClose} />
        </>}
      </>}
    </section>
  </div>
}
