import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { candidateMatches, normalizeResumePhone } from '../../services/needleIntegrationService'
import { resumeIntakeEnabled } from '../../lib/resumeIntake'
import { SelectField, TextField } from './RecordFormFields'
import { displayRankName } from '../../utils/directoryDisplay'

export default function CandidateBasicForm({ candidate, drafts = [], ranks = [], vesselTypes = [], onSaved, onCancel, onUpload }) {
  // Rank and vessel type belong to the no-CV record; reviewed candidates change them through the CV review.
  const isLead = !candidate || candidate.isDraft
  const [fields, setFields] = useState({ name: candidate?.name || '', telephone: candidate?.telephone || '', email: candidate?.email || '', rankId: candidate?.rank_id || '', vesselTypeId: candidate?.vessel_type_id || '' })
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
      const payload = { name: fields.name.trim(), telephone, email: fields.email.trim() }
      if (!payload.name) throw Error('Enter the candidate name.')
      if (isLead && (!fields.rankId || !fields.vesselTypeId)) throw Error('Choose the present rank and vessel type.')
      const leadPayload = { ...payload, rank_id: fields.rankId, vessel_type_id: fields.vesselTypeId }
      const existing = (await candidateMatches(null, payload)).filter(row => row.id !== candidate?.id)
      const found = [...existing, ...drafts.filter(row => row.id !== candidate?.id && ((payload.email && row.email?.toLowerCase() === payload.email.toLowerCase()) || (telephone && row.telephone === telephone))).map(row => ({ ...row, isDraft: true }))]
      setDuplicates(found)
      if (found.length && !confirmed) return
      const result = candidate && !candidate.isDraft
        ? await supabase.rpc('update_resume_candidate_contacts', { p_id: candidate.id, p_expected_version: candidate.version, p_fields: { ...payload, dob: candidate.dob || null, nationality_id: candidate.nationality_id || null } })
        : candidate
          ? await supabase.rpc('update_resume_lead_draft', { p_id: candidate.id, p_expected_version: candidate.version, p_fields: leadPayload })
          : await supabase.rpc('save_resume_lead_draft', { p_fields: leadPayload })
      if (result.error) throw result.error
      onSaved(candidate ? 'Candidate details saved.' : 'Candidate saved in Unattached. Add a CV before attaching.')
    } catch (failure) { setError(failure.message === 'version_conflict' ? 'This record changed. Cancel and refresh before editing again.' : failure.message) }
    finally { setBusy(false) }
  }
  return <section className="p-5" aria-label={candidate ? 'Edit candidate' : 'Add candidate'}>
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <TextField label="Candidate name" value={fields.name} required onChange={change('name')}/>
        <TextField label="Email" value={fields.email} type="email" onChange={change('email')}/>
        <TextField label="Phone with country code" value={fields.telephone} onChange={change('telephone')}/>
        {isLead && <SelectField label="Present rank" required searchable value={fields.rankId} onChange={change('rankId')} options={ranks.map(row => ({ value: row.id, label: displayRankName(row.name) }))} placeholder="Choose a rank" />}
        {isLead && <SelectField label="Vessel type" required searchable value={fields.vesselTypeId} onChange={change('vesselTypeId')} options={vesselTypes.map(row => ({ value: row.id, label: row.name }))} placeholder="Choose a vessel type" />}
      </fieldset>
      {(!candidate || candidate.isDraft) && <div className="text-sm text-fg-secondary">{resumeIntakeEnabled()
        ? <><p>Add a CV to attach this candidate to a requirement.</p><button type="button" disabled={busy} className="mt-2 workspace-action-button workspace-action-button--secondary" onClick={upload}>Add CV (optional)</button></>
        : <p>CV uploads are paused. Save the details now and add a CV later.</p>}
      </div>}
      {duplicates.length > 0 && <div className="rounded border border-warning-line p-3 text-sm"><p>Possible existing records — review before saving:</p><ul>{duplicates.map(row => <li key={`${row.isDraft ? 'draft' : 'candidate'}:${row.id}`}>{row.isDraft ? `${row.name} · CV missing` : <Link className="underline" to={`/recruiter/workspace/prospects/${row.id}`}>{row.name}</Link>}</li>)}</ul><label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I checked these records and want to save these details separately.</label></div>}
      {error && <p role="alert" className="text-danger text-sm">{error}</p>}
      <div className="flex gap-3"><button disabled={busy} className="workspace-action-button workspace-action-button--primary">{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} className="workspace-action-button workspace-action-button--secondary" onClick={onCancel}>Cancel</button></div>
    </form>
  </section>
}
