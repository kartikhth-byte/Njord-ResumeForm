import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ResumeDuplicateReview from './ResumeDuplicateReview'
import { candidateMatches, resumeCandidateFields, uploadResume, withRequirementDefaults } from '../../services/needleIntegrationService'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SelectField, TextAreaField, TextField, ToggleField } from './RecordFormFields'
import { createCandidate, emptyCandidateForm } from '../../services/recruiterRecordService'

// Create a candidate (prospect), optionally attached to an open requirement.
export default function CandidateForm({
  ranks = [],
  vesselTypes = [],
  recruiters = [],
  canChooseRecruiter = false,
  requirementOptions = [],
  currentRecruiterId = '',
  canAttach = false,
  canSave = true,
  allowUpload = true,
  initialForm = {},
  onSaved,
  onCancel,
}) {
  const [form, setForm] = useState(() => ({ ...emptyCandidateForm(currentRecruiterId), ...initialForm }))
  const [countries, setCountries] = useState([])
  const [saving, setSaving] = useState(false)
  const [matches, setMatches] = useState(() => initialForm.resume?.matches || [])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    let cancelled = false
    supabase.from('countries').select('id, name').order('name').then(({ data }) => {
      if (!cancelled) setCountries(data || [])
    })
    return () => { cancelled = true }
  }, [])

  const existingFile = form.resume?.matches?.find(row => row.reason === 'resume')
  const set = (key) => (value) => setForm((current) => ({ ...current,
    ...(!['linkTo', 'confirmNew'].includes(key) ? { linkTo: '', confirmNew: false } : {}),
    ...(key === 'rankId' ? { rankFromRequirement: false } : {}),
    ...(key === 'vesselTypeId' ? { vesselFromRequirement: false } : {}), [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const found = await candidateMatches(form.resume?.resume_id, existingFile || form.linkTo ? {} : resumeCandidateFields(form))
      setMatches(found)
      if (found.length && !existingFile && !form.linkTo && !form.confirmNew) return
      const id = await createCandidate(form, currentRecruiterId, { canAttach })
      onSaved?.('Candidate saved.', { id })
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save the candidate')
    } finally {
      setSaving(false)
    }
  }

  const options = (rows, labelKey = 'name') => rows.map((item) => ({ value: item.id, label: item[labelKey] || item.email || item.id }))

  return (
    <section ref={ref} className="recruiter-panel scroll-mt-6 p-5 sm:p-6">
      <h2 className="mb-5 text-lg font-semibold text-fg">{existingFile ? 'Existing candidate' : 'Candidate details'}</h2>
      <form className="space-y-4" onSubmit={submit}>
        {!existingFile && <p className="text-sm text-fg-secondary">Start with a name, a phone number or email, and a résumé. Phone, email, date of birth and nationality are required before progressing past contacted.</p>}
        {allowUpload && <label className="block text-sm">Résumé PDF (required)
          <input className="mt-2 block w-full" type="file" accept="application/pdf,.pdf" required={!form.resume} disabled={uploading || saving} onChange={async event => {
            const file = event.target.files?.[0]; if (!file) return
            setUploading(true); setError(''); setMatches([])
            setForm(current => ({ ...current, resume: null, linkTo: '', confirmNew: false }))
            try { const resume = await uploadResume(file); setMatches(resume.matches || []); setForm(current => ({ ...current, resume, linkTo: '', confirmNew: false })) }
            catch (failure) { setError(failure.message) }
            finally { setUploading(false) }
          }} />
        </label>}
        {form.resume && <p className="text-sm text-fg-secondary">PDF registered. {form.resume.status === 'pending' ? 'Extraction is pending; this does not approve facts.' : 'Existing approved facts are retained.'} {form.resume.intake_paused ? 'Automatic intake is currently paused.' : ''}</p>}
        {existingFile && <p className="rounded-control border border-line p-3 text-sm">This résumé already belongs to {existingFile.name}. <Link className="underline" to={`/recruiter/workspace/prospects/${existingFile.id}`}>Open existing candidate</Link>. Saving retains their details and can attach the selected requirement.</p>}
        {!existingFile && <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Candidate name" required={!existingFile && !form.linkTo} value={form.name} onChange={set('name')} placeholder="Full name" />
          <TextField label="Date of birth" type="date" value={form.dob} onChange={set('dob')} />
          <TextField label="Date contacted (if already contacted)" type="date" value={form.dateContacted} onChange={set('dateContacted')} />
          {canChooseRecruiter ? (
            <SelectField label="Added by" value={form.addedByRecruiterId} onChange={set('addedByRecruiterId')} options={options(recruiters, 'full_name')} placeholder="Choose recruiter" />
          ) : null}
          <SelectField label="Rank" value={form.rankId} onChange={set('rankId')} options={options(ranks)} placeholder="Choose a rank" />
          <SelectField label="Vessel type" value={form.vesselTypeId} onChange={set('vesselTypeId')} options={options(vesselTypes)} placeholder="Choose a vessel type" />
          <SelectField label="Nationality" value={form.nationalityId} onChange={set('nationalityId')} options={options(countries)} placeholder="Choose nationality" />
          <TextField label="Experience in rank (months)" type="number" value={form.expInRankMonths} onChange={set('expInRankMonths')} placeholder="0" />
          <TextField label="Telephone" value={form.telephone} onChange={set('telephone')} placeholder="+919999999999" />
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} placeholder="candidate@example.com" />
          <TextField
            label="Previous employer"
            value={form.previousEmployer}
            onChange={set('previousEmployer')}
            placeholder="Optional"
          />
          <TextField label="Lead source" value={form.leadSource} onChange={set('leadSource')} placeholder="Referral, walk-in, search..." />
        </div>}
        {canAttach ? (
          <SelectField
            label="Attach to requirement (optional)"
            value={form.requirementId}
            onChange={value => setForm(current => withRequirementDefaults(current, requirementOptions.find(row => row.value === value)))}
            options={requirementOptions}
            placeholder="Leave unattached for now"
          />
        ) : null}
        {!existingFile && (form.rankFromRequirement || form.vesselFromRequirement) && <p className="text-sm text-fg-secondary">{[form.rankFromRequirement && 'Rank', form.vesselFromRequirement && 'Vessel type'].filter(Boolean).join(' and ')} suggested from the requirement. Review or clear these optional fields before saving.</p>}
        {!existingFile && <><ToggleField
          label="First time at sea"
          checked={form.isFirstTimeAtSea}
          onChange={set('isFirstTimeAtSea')}
        />
        <TextAreaField label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional candidate notes" />
        <ResumeDuplicateReview matches={matches} value={form.linkTo || ''} onChange={set('linkTo')} confirmNew={Boolean(form.confirmNew)} onConfirmNew={set('confirmNew')} /></>}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="workspace-action-button workspace-action-button--primary" disabled={!canSave || saving || uploading || !form.resume}>
            <Plus className="h-4 w-4" />
            {existingFile ? form.requirementId ? 'Attach existing candidate' : 'Use existing candidate' : 'Save candidate'}
          </button>
          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
