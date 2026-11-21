import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { candidateMatches, normalizeResumePhone, openIntakeOriginal, uploadResume, withRequirementDefaults } from '../../services/needleIntegrationService'
import { createCandidate } from '../../services/recruiterRecordService'
import { resumeIntakeEnabled } from '../../lib/resumeIntake'
import { SelectField, TextField } from './RecordFormFields'
import ResumeDuplicateReview from './ResumeDuplicateReview'
import ResumeSuggestionReview from './ResumeSuggestionReview'
import { displayRankName } from '../../utils/directoryDisplay'
import { fillFromCv } from '../../utils/candidateCvFill'

// The one add/edit candidate form. A CV is optional: with one, the details are
// filled in from it for the recruiter to check; without one, a no-CV record is saved.
export default function CandidateBasicForm({ candidate, drafts = [], ranks = [], vesselTypes = [], requirementOptions = [], canAttach = false, currentRecruiterId = '', initialResume = null, onSaved, onCancel }) {
  // Rank and vessel type belong to the no-CV record; reviewed candidates change them through the CV review.
  const isLead = !candidate || candidate.isDraft
  const cvAllowed = isLead && resumeIntakeEnabled()
  const [fields, setFields] = useState(() => {
    const start = { name: candidate?.name || '', telephone: candidate?.telephone || '', email: candidate?.email || '', rankId: candidate?.rank_id || '', vesselTypeId: candidate?.vessel_type_id || '', requirementId: '' }
    return initialResume ? fillFromCv(start, initialResume, ranks, vesselTypes) : start
  })
  const [resume, setResume] = useState(initialResume)
  const [reading, setReading] = useState(false)
  const [slow, setSlow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState([])
  const [confirmed, setConfirmed] = useState(false)
  const [matches, setMatches] = useState(() => initialResume?.matches || [])
  const [identity, setIdentity] = useState({ linkTo: '', confirmNew: false })
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    if (!reading) { setSlow(false); return undefined }
    const timer = setTimeout(() => setSlow(true), 20000)
    return () => clearTimeout(timer)
  }, [reading])
  const existingFile = resume?.matches?.find(row => row.reason === 'resume')
  const change = key => value => { setFields(f => ({ ...f, [key]: value })); setConfirmed(false); setDuplicates([]); setChecked(false) }
  const chooseRequirement = value => { setChecked(false); setFields(f => withRequirementDefaults(f, requirementOptions.find(row => row.value === value))) }

  const readCv = async file => {
    if (!file) return
    setReading(true); setError(''); setResume(null); setMatches([]); setChecked(false); setIdentity({ linkTo: '', confirmNew: false })
    try {
      const uploaded = await uploadResume(file)
      setResume(uploaded); setMatches(uploaded.matches || [])
      setFields(f => fillFromCv(f, uploaded, ranks, vesselTypes))
    } catch (failure) { setError(failure.message) }
    finally { setReading(false) }
  }

  const saveWithCv = async () => {
    if (!checked) throw Error('Tick the box to confirm you checked the details against the CV.')
    if (!existingFile && (!fields.rankId || !fields.vesselTypeId)) throw Error('Choose the present rank and vessel type.')
    let lead = {}
    if (candidate?.isDraft) {
      // The directory omits private notes. Fetch them only through the existing
      // draft RLS for an authorized conversion, so conversion preserves them.
      const { data, error: readError } = await supabase.from('resume_lead_drafts').select('notes,version').eq('id', candidate.id).single()
      if (readError) throw readError
      if (data.version !== candidate.version) throw Error('This record changed. Cancel and refresh before adding a CV.')
      lead = { leadId: candidate.id, leadVersion: data.version, notes: data.notes || '' }
    }
    const requirement = requirementOptions.find(row => row.value === fields.requirementId)
    const form = { ...fields, ...lead, ...identity, resume, dob: '', nationalityId: '', expInRankMonths: '', requirementVersion: requirement?.version, addedByRecruiterId: currentRecruiterId }
    if (!existingFile && !identity.linkTo) {
      const found = await candidateMatches(resume.resume_id, { name: fields.name, email: fields.email, telephone: normalizeResumePhone(fields.telephone) })
      setMatches(found)
      if (found.length && !identity.confirmNew) return
    }
    const id = await createCandidate(form, currentRecruiterId, { canAttach })
    onSaved(fields.requirementId && canAttach ? 'Candidate saved and attached.' : 'Candidate saved.', { id })
  }

  const saveWithoutCv = async () => {
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
  }

  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await (resume ? saveWithCv() : saveWithoutCv()) }
    catch (failure) { setError(failure.message === 'version_conflict' ? 'This record changed. Cancel and refresh before editing again.' : failure.message) }
    finally { setBusy(false) }
  }

  return <section className="p-5" aria-label={candidate ? 'Edit candidate' : 'Add candidate'}>
    <form onSubmit={submit} className="space-y-4">
      {cvAllowed && <div className="rounded-control border border-line p-4 text-sm">
        <label className="block font-medium text-fg-secondary">CV (PDF, optional)
          <input type="file" accept="application/pdf,.pdf" disabled={busy || reading} className="mt-2 block w-full text-fg" onChange={event => readCv(event.target.files?.[0])}/>
        </label>
        {reading && <div className="cv-progress mt-3" role="progressbar" aria-label="Reading CV"><span/></div>}
        <p className="mt-2 text-fg-secondary" role="status">{reading ? (slow ? 'Still working… scanned CVs can take up to a minute. You can keep typing.' : 'Reading CV… this takes a few seconds (longer for scanned CVs). You can keep typing.') : resume ? <>Details filled in from the CV. Check them before saving. <button type="button" className="underline" onClick={async () => { try { await openIntakeOriginal(resume.resume_version_id) } catch (e) { setError(e.message) } }}>View CV</button></> : 'Add a CV to fill in the details and to attach to a requirement.'}</p>
      </div>}
      {!cvAllowed && isLead && <p className="text-sm text-fg-secondary">CV uploads are paused. Save the details now and add a CV later.</p>}
      {existingFile
        ? <p className="rounded-control border border-line p-3 text-sm">This CV already belongs to {existingFile.name}. <Link className="underline" to={`/recruiter/workspace/prospects/${existingFile.id}`}>Open existing candidate</Link>. Saving keeps their details{canAttach ? ' and can attach the chosen requirement' : ''}.</p>
        : <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Candidate name" value={fields.name} required onChange={change('name')}/>
          <TextField label="Email" value={fields.email} type="email" onChange={change('email')}/>
          <TextField label="Phone with country code" value={fields.telephone} onChange={change('telephone')} placeholder="+919000000001"/>
          {isLead && <SelectField label="Present rank" required searchable value={fields.rankId} onChange={change('rankId')} options={ranks.map(row => ({ value: row.id, label: displayRankName(row.name) }))} placeholder="Choose a rank" />}
          {isLead && <SelectField label="Vessel type" required searchable value={fields.vesselTypeId} onChange={change('vesselTypeId')} options={vesselTypes.map(row => ({ value: row.id, label: row.name }))} placeholder="Choose a vessel type" />}
        </fieldset>}
      {resume && canAttach && <SelectField label="Attach to requirement (optional)" searchable value={fields.requirementId} onChange={chooseRequirement} options={requirementOptions} placeholder="Leave unattached for now" />}
      {resume && <details className="text-sm"><summary className="cursor-pointer text-fg-secondary">What the CV says</summary><div className="mt-2"><ResumeSuggestionReview resume={resume}/></div></details>}
      {resume && !existingFile && <ResumeDuplicateReview matches={matches} value={identity.linkTo} onChange={linkTo => { setChecked(false); setIdentity(i => ({ ...i, linkTo })) }} confirmNew={identity.confirmNew} onConfirmNew={confirmNew => { setChecked(false); setIdentity(i => ({ ...i, confirmNew })) }}/>}
      {duplicates.length > 0 && <div className="rounded border border-warning-line p-3 text-sm"><p>Possible existing records — review before saving:</p><ul>{duplicates.map(row => <li key={`${row.isDraft ? 'draft' : 'candidate'}:${row.id}`}>{row.isDraft ? `${row.name} · CV missing` : <Link className="underline" to={`/recruiter/workspace/prospects/${row.id}`}>{row.name}</Link>}</li>)}</ul><label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I checked these records and want to save these details separately.</label></div>}
      {resume && <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/>I checked these details against the CV.</label>}
      {error && <p role="alert" className="text-danger text-sm">{error}</p>}
      <div className="flex gap-3"><button disabled={busy || reading} className="workspace-action-button workspace-action-button--primary">{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} className="workspace-action-button workspace-action-button--secondary" onClick={onCancel}>Cancel</button></div>
    </form>
  </section>
}
