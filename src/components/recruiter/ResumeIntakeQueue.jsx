import { useEffect,useState } from 'react'
import { supabase } from '../../lib/supabase'
import { platformIntake } from '../../services/needleIntegrationService'

export default function ResumeIntakeQueue({onReview}) {
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const load=async()=>{
    setBusy(true);setError('')
    const {data,error}=await supabase.rpc('platform_resume_review_queue')
    if(error)setError(error.message);else setRows(data||[])
    setBusy(false)
  }
  useEffect(()=>{void load()},[])
  return <section className="recruiter-panel mt-6 p-5" aria-label="Resume intake review queue">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Résumé intake review queue</h2><button disabled={busy} className="underline text-sm" onClick={load}>Refresh intake queue</button></div>
    <p className="mt-2 text-sm text-fg-secondary">Stored originals awaiting a reviewed identity. Held or failed extraction never creates a candidate automatically.</p>
    {error&&<p role="alert" className="mt-2 text-danger">{error}</p>}
    {!rows.length&&!error&&<p className="mt-2 text-sm">No outstanding intake reviews.</p>}
    <ul className="mt-3 space-y-2">{rows.map(row=><li key={row.resume_version_id} className="flex flex-wrap justify-between gap-3 rounded border border-line p-3 text-sm"><span className="min-w-0 break-all">{row.filename} · {row.identity_status?.replaceAll('_',' ')} · {(row.extraction_status||'Extraction pending').replaceAll('_',' ')}</span><button disabled={busy} className="underline" onClick={async()=>{setBusy(true);setError('');try{const result=await platformIntake({action:'prepare_version',resume_version_id:row.resume_version_id});onReview(result.resumes[0])}catch(e){setError(e.message)}finally{setBusy(false)}}}>Review intake</button><button disabled={busy} className="underline" onClick={async()=>{setBusy(true);setError('');try{await platformIntake({action:'retry_extract',resume_version_id:row.resume_version_id});await load()}catch(e){setError(e.message)}finally{setBusy(false)}}}>Retry basic extraction</button></li>)}</ul>
  </section>
}
