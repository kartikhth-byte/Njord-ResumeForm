import { Link } from 'react-router-dom'
import useClientFleet from '../../hooks/useClientFleet'
import { SelectField } from './RecordFormFields'

export default function ClientFleetFields({form, onChange}) {
  const fleet = useClientFleet({ includeArchived: true })
  const selectShip = value => {
    const ship = fleet.ships.find(row => row.id === value)
    onChange({shipId: value, vesselTypeId: ship?.vessel_type_id || ''})
  }
  return <div className="space-y-3 md:col-span-2">
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Company" value={form.companyId} onChange={value => onChange({companyId: value, shipId: '', vesselTypeId: ''})} options={fleet.companies.filter(r => !r.archived_at || r.id === form.companyId).map(r => ({value: r.id, label: r.name + (r.archived_at ? ' (archived)' : '')}))} placeholder="Company pending / Draft"/>
      <SelectField label="Ship" value={form.shipId} onChange={selectShip} options={fleet.ships.filter(r => r.company_id === form.companyId && (!r.archived_at || r.id === form.shipId)).map(r => ({value: r.id, label: r.name + (r.archived_at ? ' (archived)' : '')}))} placeholder="Ship pending / Draft"/>
    </div>
    {fleet.error && <p role="alert" className="text-danger">Could not load companies and ships. Please refresh the list.</p>}
    <div className="flex flex-wrap gap-4 text-sm">
      <Link className="text-accent-text underline" to="/recruiter/companies" target="_blank" rel="noopener noreferrer">Companies &amp; ships (new tab)</Link>
      <button type="button" className="underline" onClick={fleet.reload}>Refresh company and ship list</button>
    </div>
    <p className="text-xs text-fg-muted">Add or correct names in Companies &amp; ships, then refresh this list. Your requirement stays here.</p>
  </div>
}
