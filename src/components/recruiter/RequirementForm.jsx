import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { SelectField, TextAreaField, TextField } from './RecordFormFields'
import { emptyRequirementForm, requirementFormFromRow, saveRequirement } from '../../services/recruiterRecordService'

const STATUS_OPTIONS = [
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
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Date opened" type="date" required value={form.dateOpened} onChange={set('dateOpened')} />
          <TextField label="Vessel" required value={form.vesselName} onChange={set('vesselName')} placeholder="Vessel name" />
          <SelectField
            label="Vessel type"
            required
            value={form.vesselTypeId}
            onChange={set('vesselTypeId')}
            options={vesselTypes.map((item) => ({ value: item.id, label: item.name }))}
            placeholder="Choose a vessel type"
          />
          <SelectField
            label="Rank"
            required
            value={form.rankId}
            onChange={set('rankId')}
            options={ranks.map((item) => ({ value: item.id, label: item.name }))}
            placeholder="Choose a rank"
          />
          <TextField label="Positions required" type="number" required value={form.positionsRequired} onChange={set('positionsRequired')} placeholder="1" />
          <TextField label="Target days" type="number" required value={form.targetDays} onChange={set('targetDays')} placeholder="30" />
          <SelectField label="Requirement status" required value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
          <TextField label="Customer name" value={form.customerName} onChange={set('customerName')} placeholder="Optional" />
        </div>
        {canChooseRecruiter && !form.id ? (
          <SelectField
            label="Logged by"
            value={form.loggedByRecruiterId}
            onChange={set('loggedByRecruiterId')}
            options={recruiters.map((item) => ({ value: item.id, label: item.full_name || item.email || item.id }))}
            placeholder="Choose recruiter"
          />
        ) : null}
        <TextAreaField label="Remarks / notes" value={form.notes} onChange={set('notes')} placeholder="Optional notes for this requirement" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="workspace-action-button workspace-action-button--primary" disabled={!canSave || saving}>
            <Plus className="h-4 w-4" />
            {form.id ? 'Update requirement' : 'Save requirement'}
          </button>
          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
