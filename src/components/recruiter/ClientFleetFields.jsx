import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import useClientFleet from '../../hooks/useClientFleet'
import { SelectField, TextField } from './RecordFormFields'

export default function ClientFleetFields({form,onChange}) {
  const fleet=useClientFleet()
  const [creating,setCreating]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const create=async()=>{
    setBusy(true);setError('')
    try{
      if(!name.trim())throw Error('Enter a name.')
      const table=creating==='company'?'client_companies':'client_ships'
      const {data,error}=await supabase.from(table).insert({name:name.trim(),...(creating==='ship'?{company_id:form.companyId}:{})}).select('id').single()
      if(error)throw error
      onChange(creating==='company'?{companyId:data.id,shipId:''}:{shipId:data.id})
      setCreating('');setName('');await fleet.reload()
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div className="space-y-3 md:col-span-2">
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Company" value={form.companyId} onChange={value=>onChange({companyId:value,shipId:''})} options={fleet.companies.map(r=>({value:r.id,label:r.name}))} placeholder="Company pending / Draft"/>
      <SelectField label="Ship" value={form.shipId} onChange={value=>onChange({shipId:value})} options={fleet.ships.filter(r=>r.company_id===form.companyId).map(r=>({value:r.id,label:r.name}))} placeholder="Ship pending / Draft"/>
    </div>
    {fleet.error&&<p role="alert" className="text-danger">{fleet.error}</p>}
    <div className="flex gap-4 text-sm"><button type="button" className="underline" onClick={()=>{setCreating('company');setName('')}}>Register company</button><button type="button" disabled={!form.companyId} className="underline disabled:opacity-50" onClick={()=>{setCreating('ship');setName('')}}>Register ship for company</button></div>
    {creating&&<div className="rounded border border-line p-3"><TextField label={`New ${creating} name (review before saving)`} value={name} onChange={setName}/><button type="button" disabled={busy} className="workspace-action-button workspace-action-button--secondary mt-2" onClick={create}>Register {creating}</button><button type="button" className="ml-4 underline" onClick={()=>setCreating('')}>Cancel registration</button></div>}
    {error&&<p role="alert" className="text-danger">{error}</p>}
  </div>
}
