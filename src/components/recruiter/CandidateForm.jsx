import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SelectField, TextAreaField, TextField, ToggleField } from './RecordFormFields'
import { createCandidate, emptyCandidateForm } from '../../services/recruiterRecordService'

// Create a candidate (prospect), optionally attached to an open requirement.
export default function CandidateForm({
  ranks = [],
  vesselTypes = [],
  recruiters = [],
  requirementOptions = [],
  currentRecruiterId = '',
  canAttach = false,
  canSave = true,
  onSaved,
  onCancel,
}) {
  const [form, setForm] = useState(() => emptyCandidateForm(currentRecruiterId))
  const [countries, setCountries] = useState([])
  const [saving, setSaving] = useState(false)
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

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const id = await createCandidate(form, currentRecruiterId, { canAttach })
      onSaved?.('Candidate created.', { id })
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save the candidate')
    } finally {
      setSaving(false)
    }
  }

  const options = (rows, labelKey = 'name') => rows.map((item) => ({ value: item.id, label: item[labelKey] || item.email || item.id }))

  return (
    <section ref={ref} className="recruiter-panel scroll-mt-6 p-5 sm:p-6">
      <h2 className="mb-5 text-lg font-semibold text-fg">New candidate</h2>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Candidate name" required value={form.name} onChange={set('name')} placeholder="Full name" />
          <TextField label="Date of birth" type="date" required value={form.dob} onChange={set('dob')} />
          <TextField label="Date contacted" type="date" required value={form.dateContacted} onChange={set('dateContacted')} />
          <SelectField label="Added by" value={form.addedByRecruiterId} onChange={set('addedByRecruiterId')} options={options(recruiters, 'full_name')} placeholder="Choose recruiter" />
          <SelectField label="Rank" required value={form.rankId} onChange={set('rankId')} options={options(ranks)} placeholder="Choose a rank" />
          <SelectField label="Vessel type" required value={form.vesselTypeId} onChange={set('vesselTypeId')} options={options(vesselTypes)} placeholder="Choose a vessel type" />
          <SelectField label="Nationality" required value={form.nationalityId} onChange={set('nationalityId')} options={options(countries)} placeholder="Choose nationality" />
          <TextField label="Experience in rank (months)" required type="number" value={form.expInRankMonths} onChange={set('expInRankMonths')} placeholder="0" />
          <TextField label="Telephone" required value={form.telephone} onChange={set('telephone')} placeholder="+919999999999" />
          <TextField label="Email" type="email" required value={form.email} onChange={set('email')} placeholder="candidate@example.com" />
          <TextField
            label="Previous employer"
            required={!form.isFirstTimeAtSea}
            value={form.previousEmployer}
            onChange={set('previousEmployer')}
            placeholder={form.isFirstTimeAtSea ? 'Optional' : 'Required unless first time at sea'}
          />
          <TextField label="Lead source" value={form.leadSource} onChange={set('leadSource')} placeholder="Referral, walk-in, search..." />
        </div>
        {canAttach ? (
          <SelectField
            label="Attach to requirement (optional)"
            value={form.requirementId}
            onChange={set('requirementId')}
            options={requirementOptions}
            placeholder="Leave unattached for now"
          />
        ) : null}
        <ToggleField
          label="First time at sea"
          checked={form.isFirstTimeAtSea}
          onChange={set('isFirstTimeAtSea')}
          description="If checked, previous employer stays optional."
        />
        <TextAreaField label="Notes" value={form.notes} onChange={set('notes')} placeholder="Optional candidate notes" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="workspace-action-button workspace-action-button--primary" disabled={!canSave || saving}>
            <Plus className="h-4 w-4" />
            Save candidate
          </button>
          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
