import {Link} from 'react-router-dom'
import useClientFleet from '../../hooks/useClientFleet'
import { SelectField } from './RecordFormFields'
import { CASE_STATUS_META, caseStatusMeta } from '../../utils/recruitmentCase'

export default function FleetRequirementFilter({value,onChange,requirements=[],cases=false,title}) {
  const fleet=useClientFleet()
  const options=rows=>rows.map(r=>({value:r.id,label:r.name||r.req_id_display}))
  return <section aria-label="Company and ship navigation" className="recruiter-panel mt-6 space-y-3 p-5">
    <h2 className="font-semibold">{title || `Company → Ship → Requirement${cases ? ' → Case stage' : ''}`}</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField label="Company" value={value.company} onChange={company=>onChange({...value,company,ship:'',requirement:''})} options={options(fleet.companies)} placeholder="All companies"/>
      <SelectField label="Ship" value={value.ship} onChange={ship=>onChange({...value,ship,requirement:''})} options={options(fleet.ships.filter(r=>!value.company||r.company_id===value.company))} placeholder="All ships"/>
      {cases&&<><SelectField label="Requirement" value={value.requirement} onChange={requirement=>onChange({...value,requirement})} options={options(requirements.filter(r=>(!value.company||r.company_id===value.company)&&(!value.ship||r.ship_id===value.ship)))} placeholder="All requirements"/>
      <SelectField label="Case stage" value={value.stage} onChange={stage=>onChange({...value,stage})} options={Object.keys(CASE_STATUS_META).map(status=>({value:status,label:caseStatusMeta(status).label}))} placeholder="All case stages"/></>}
    </div>
    {!cases&&<details className="rounded border border-line p-3 text-sm"><summary className="cursor-pointer font-medium">Browse company and ship tree</summary>
      <ul className="mt-3 space-y-2">{fleet.companies.map(company=><li key={company.id}><details><summary className="cursor-pointer break-words">{company.name}</summary><ul className="ml-4 mt-2 space-y-2">{fleet.ships.filter(ship=>ship.company_id===company.id).map(ship=><li key={ship.id}><details><summary className="cursor-pointer break-words">{ship.name}</summary><ul className="ml-4 mt-2 space-y-1">{requirements.filter(r=>r.ship_id===ship.id&&!r.deleted_at).map(r=><li key={r.id}><Link className="underline" to={`/recruiter/workspace/requirements/${r.id}`}>{r.req_id_display} · {r.status}</Link></li>)}</ul></details></li>)}</ul></details></li>)}</ul>
      {!fleet.companies.length&&<p className="mt-2">Add companies and ships on the Companies & ships page.</p>}
    </details>}
    {fleet.error&&<p role="alert" className="text-danger">{fleet.error}</p>}
    <p className="text-xs text-fg-muted">Legacy unreviewed company and vessel labels remain in the All view. They are never automatically assigned to a ship.</p>
  </section>
}
