import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
export default function ResumeLeadQueue({onContinue}) {
 const [rows,setRows]=useState([]),[error,setError]=useState('')
 const load=async()=>{const {data,error}=await supabase.from('resume_lead_drafts').select('id,name,telephone,email,notes,version').eq('status','draft').order('created_at',{ascending:false});setRows(data||[]);setError(error?.message||'')}
 useEffect(()=>{void load()},[])
 return <section className="recruiter-panel mt-6 p-5" aria-label="Draft leads"><div className="flex justify-between gap-3"><h2 className="font-semibold">Draft leads — résumé missing</h2><button className="underline text-sm" onClick={load}>Refresh draft leads</button></div><p className="mt-2 text-sm text-fg-secondary">Outside the candidate pool. Add and review a résumé before creating a candidate or case.</p>{error&&<p role="alert" className="text-danger">{error}</p>}
 <ul className="mt-3 space-y-2">{rows.map(row=><li className="flex flex-wrap justify-between gap-3 rounded border border-line p-3 text-sm" key={row.id}><span className="min-w-0 break-words">{row.name||'Unnamed draft'} · {row.telephone||row.email}</span><button className="underline" onClick={()=>onContinue({name:row.name||'',telephone:row.telephone||'',email:row.email||'',notes:row.notes||'',leadId:row.id,leadVersion:row.version})}>Continue draft lead</button></li>)}</ul>{!rows.length&&!error&&<p className="mt-2 text-sm">No draft leads.</p>}</section>
}
