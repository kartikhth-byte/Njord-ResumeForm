import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { normalizeResumePhone } from '../../services/needleIntegrationService'
import RecordFormDialog from './RecordFormDialog'

// Edits a reviewed candidate's contact details (moved here from the CV panel).
export default function CandidateContactDialog({ candidate, countries, onSaved, onClose }) {
  const [fields, setFields] = useState({ name: candidate.name || '', email: candidate.email || '', telephone: candidate.telephone || '', dob: candidate.dob || '', nationality_id: candidate.nationality_id || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = key => event => setFields(previous => ({ ...previous, [key]: event.target.value }))
  const save = async event => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const telephone = normalizeResumePhone(fields.telephone)
      if (fields.telephone.trim() && !telephone) throw new Error('Enter a phone number with its country code.')
      const { error: failure } = await supabase.rpc('update_resume_candidate_contacts', { p_id: candidate.id, p_expected_version: candidate.version, p_fields: { ...fields, telephone } })
      if (failure) throw failure
      onSaved?.()
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  const input = 'mt-1 w-full rounded-control border border-line bg-surface p-3'
  return <RecordFormDialog title="Edit contact details" busy={busy} onClose={onClose}>
    <form className="space-y-4 p-5" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Name<input className={input} required value={fields.name} onChange={set('name')} /></label>
        <label className="block text-sm">Phone with country code<input className={input} type="tel" value={fields.telephone} onChange={set('telephone')} /></label>
        <label className="block text-sm">Email<input className={input} type="email" value={fields.email} onChange={set('email')} /></label>
        <label className="block text-sm">Date of birth<input className={input} type="date" value={fields.dob} onChange={set('dob')} /></label>
        <label className="block text-sm">Nationality<select className={input} value={fields.nationality_id} onChange={set('nationality_id')}><option value="">Not provided</option>{Object.entries(countries).map(([id, row]) => <option key={id} value={id}>{typeof row === 'string' ? row : row.name}</option>)}</select></label>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3"><button disabled={busy} className="workspace-action-button workspace-action-button--primary">Save</button><button type="button" disabled={busy} className="workspace-action-button workspace-action-button--secondary" onClick={onClose}>Cancel</button></div>
    </form>
  </RecordFormDialog>
}
