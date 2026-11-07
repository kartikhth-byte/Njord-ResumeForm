import ClientFleetFields from './ClientFleetFields'
import { useEffect, useRef, useState } from 'react'
import { SelectField, TextAreaField, TextField } from './RecordFormFields'
import { emptyRequirementForm, requirementFormFromRow, saveRequirement } from '../../services/recruiterRecordService'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft — ship pending / not published' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Add or edit a requirement. Opens scrolled into view; closes via onCancel or
// after a successful save (onSaved receives a short message).
export default function RequirementForm({
  requirement = null,
  ranks = [],
  vesselTypes = [],
  recruiters = [],
  currentRecruiterId = '',
  canChooseRecruiter = false,
  canSave = true,
  onSaved,
  onCancel,
}) {
  const [form, setForm] = useState(() => (
    requirement ? requirementFormFromRow(requirement, currentRecruiterId) : emptyRequirementForm(currentRecruiterId)
  ))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if(requirement?.status==='open'&&form.status==='closed'&&!window.confirm('Close this requirement? Some positions may remain unfilled.'))return
    setSaving(true)
    setError('')
    try {
      const result = await saveRequirement(form, currentRecruiterId)
      onSaved?.(result.created ? 'Requirement created.' : 'Requirement updated.', result)
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save the requirement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section ref={ref} className="recruiter-panel scroll-mt-6 p-5 sm:p-6">
      <h2 className="mb-5 text-lg font-semibold text-fg">{form.id ? 'Edit requirement' : 'New requirement'}</h2>
      <p className="mb-4 text-sm text-fg-secondary">Drafts can wait for a ship. Only reviewed open requirements accept cases and résumé matching.</p>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <ClientFleetFields form={form} onChange={patch=>setForm(current=>({...current,...patch}))}/>
          {requirement?.status!=='draft' && form.id && (form.companyId!==requirement.company_id || form.shipId!==requirement.ship_id) && <TextField label="Reason for company / ship correction (audited)" required value={form.correctionReason} onChange={set('correctionReason')}/>}
          {requirement && !requirement.location_reviewed_at && <p className="text-sm text-warning md:col-span-2">Legacy labels: {requirement.customer_name||'No company'} / {requirement.vessel_name||'No ship'}. Select reviewed identities explicitly before matching or opening cases.</p>}
          <p className="text-sm text-fg-muted md:col-span-2">The opening date is recorded when a Draft is opened.</p>

          <SelectField
            label="Vessel type"
            required={form.status!=='draft'}
            value={form.vesselTypeId}
            onChange={set('vesselTypeId')}
            options={vesselTypes.map((item) => ({ value: item.id, label: item.name }))}
            placeholder="Choose a vessel type"
          />
          <SelectField
            label="Rank"
            required={form.status!=='draft'}
            value={form.rankId}
            onChange={set('rankId')}
            options={ranks.map((item) => ({ value: item.id, label: item.name }))}
            placeholder="Choose a rank"
          />
          <TextField label="Positions required" type="number" required={form.status!=='draft'} value={form.positionsRequired} onChange={set('positionsRequired')} placeholder="1" />
          <TextField label="Target days" type="number" required={form.status!=='draft'} value={form.targetDays} onChange={set('targetDays')} placeholder="30" />
          {(
            <SelectField
              label="Status"
              required={form.status!=='draft'}
              value={form.status}
              onChange={set('status')}
              options={STATUS_OPTIONS.filter(option => (option.value!=='draft'||!form.id||requirement?.status==='draft') && (option.value!=='closed'||Boolean(form.id&&requirement?.status!=='draft')) && (option.value!=='cancelled'||form.status==='cancelled'))}
            />
          )}
        </div>
        {canChooseRecruiter && !form.id ? (
          <SelectField
            label="Recruiter"
            value={form.loggedByRecruiterId}
            onChange={set('loggedByRecruiterId')}
            options={recruiters.map((item) => ({ value: item.id, label: item.full_name || item.email || item.id }))}
            placeholder="Choose recruiter"
          />
        ) : null}
        <TextAreaField label="Add remark" value={form.notes} onChange={set('notes')} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="workspace-action-button workspace-action-button--primary" disabled={!canSave || saving}>
            Save
          </button>
          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
