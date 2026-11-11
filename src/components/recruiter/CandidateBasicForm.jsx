import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { candidateMatches, normalizeResumePhone } from '../../services/needleIntegrationService'
import { resumeIntakeEnabled } from '../../lib/resumeIntake'
import { TextField } from './RecordFormFields'

export default function CandidateBasicForm({ candidate, drafts = [], onSaved, onCancel, onUpload }) {
  const [fields, setFields] = useState({ name: candidate?.name || '', telephone: candidate?.telephone || '', email: candidate?.email || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState([])
  const [confirmed, setConfirmed] = useState(false)
  const change = key => value => { setFields(f => ({ ...f, [key]: value })); setConfirmed(false); setDuplicates([]) }
  const upload = async () => {
    setBusy(true); setError('')
    try {
      let leadFields = {}
      if (candidate?.isDraft) {
        // The directory omits private notes. Fetch them only through the existing
        // draft RLS for an authorized conversion, so conversion preserves them.
        const {data,error:readError} = await supabase.from('resume_lead_drafts').select('notes,version').eq('id',candidate.id).single()
        if (readError) throw readError
        if (data.version !== candidate.version) throw Error('This record changed. Cancel and refresh before adding a CV.')
        leadFields = {leadId:candidate.id,leadVersion:data.version,notes:data.notes || ''}
      }
      onUpload({...fields,...leadFields})
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const telephone = normalizeResumePhone(fields.telephone)
      if (fields.telephone.trim() && !telephone) throw Error('Enter a phone number with its country code.')
      if (!telephone && !fields.email.trim()) throw Error('Enter a phone number or email.')
      const payload = { ...fields, name: fields.name.trim(), telephone, email: fields.email.trim() }
      if (!payload.name) throw Error('Enter the candidate name.')
      const existing = (await candidateMatches(null, payload)).filter(row => row.id !== candidate?.id)
      const found = [...existing, ...drafts.filter(row => row.id !== candidate?.id && ((payload.email && row.email?.toLowerCase() === payload.email.toLowerCase()) || (telephone && row.telephone === telephone))).map(row => ({ ...row, isDraft: true }))]
      setDuplicates(found)
      if (found.length && !confirmed) return
      const result = candidate && !candidate.isDraft
        ? await supabase.rpc('update_resume_candidate_contacts', { p_id: candidate.id, p_expected_version: candidate.version, p_fields: { ...payload, dob: candidate.dob || null, nationality_id: candidate.nationality_id || null } })
        : candidate
          ? await supabase.rpc('update_resume_lead_draft', { p_id: candidate.id, p_expected_version: candidate.version, p_fields: payload })
          : await supabase.rpc('save_resume_lead_draft', { p_fields: payload })
      if (result.error) throw result.error
      onSaved(candidate ? 'Candidate details saved.' : 'Candidate saved in Unattached. Add a CV before attaching.')
    } catch (failure) { setError(failure.message === 'version_conflict' ? 'This record changed. Cancel and refresh before editing again.' : failure.message) }
    finally { setBusy(false) }
  }
  return <section className="recruiter-panel mt-5 p-5" aria-label={candidate ? 'Edit candidate' : 'Add candidate'}>
    <h2 className="font-semibold mb-4">{candidate ? 'Edit candidate' : 'Add candidate'}</h2>
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Candidate name" value={fields.name} required onChange={change('name')}/>
        <TextField label="Email" value={fields.email} type="email" onChange={change('email')}/>
        <TextField label="Phone with country code" value={fields.telephone} onChange={change('telephone')}/>
      </fieldset>
      {(!candidate || candidate.isDraft) && <div className="text-sm text-fg-secondary"><p>CV is optional when saving. A reviewed CV is required before attachment.</p>
        <button type="button" disabled={busy || !resumeIntakeEnabled()} className="mt-2 workspace-action-button workspace-action-button--secondary disabled:opacity-50" onClick={upload}>Add CV (optional)</button>
        {!resumeIntakeEnabled() && <p className="mt-2">CV uploads are temporarily unavailable. You can save and edit basic details now.</p>}
      </div>}
      {duplicates.length > 0 && <div className="rounded border border-warning-line p-3 text-sm"><p>Possible existing records — review before saving:</p><ul>{duplicates.map(row => <li key={`${row.isDraft ? 'draft' : 'candidate'}:${row.id}`}>{row.isDraft ? `${row.name} · CV missing` : <Link className="underline" to={`/recruiter/workspace/prospects/${row.id}`}>{row.name}</Link>}</li>)}</ul><label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I checked these records and want to save these details separately.</label></div>}
      {error && <p role="alert" className="text-danger text-sm">{error}</p>}
      <div className="flex gap-3"><button disabled={busy} className="workspace-action-button workspace-action-button--primary">{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} className="workspace-action-button workspace-action-button--secondary" onClick={onCancel}>Cancel</button></div>
    </form>
  </section>
}
