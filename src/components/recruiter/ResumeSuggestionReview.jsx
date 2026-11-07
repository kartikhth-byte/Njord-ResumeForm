import {useState} from 'react'
import {openIntakeOriginal} from '../../services/needleIntegrationService'
export default function ResumeSuggestionReview({resume,onApply}) {
  const [error,setError]=useState('')
  if(!resume)return null
  return <section className="space-y-3 rounded-control border border-line p-4" aria-label="Extraction suggestions">
    <h3 className="font-semibold">Review résumé suggestions</h3>
    <button type="button" className="underline text-sm" onClick={async()=>{setError('');try{await openIntakeOriginal(resume.resume_version_id)}catch(e){setError(e.message)}}}>View stored original</button>
    {error&&<p role="alert" className="text-danger">{error}</p>}
    <p className="text-sm text-fg-secondary">Storage: original retained · Basic extraction: {resume.status?.replaceAll('_',' ')} · Indexing: {(resume.indexing_status||'pending').replaceAll('_',' ')}. Suggestions do not change confirmed candidate details.</p>
    <p className="text-sm">{resume.page_count??'Unknown'} pages accounted for</p><details className="text-xs text-fg-muted"><summary className="cursor-pointer">Extraction provenance</summary>{resume.contract_version} · {resume.extractor_version}</details>
    {resume.warnings?.map((warning,i)=><p className="text-sm text-warning" key={i}>Page {warning.page||'—'}: {warning.code}</p>)}
    {Object.entries(resume.fields||{}).map(([key,rows])=><div key={key}><h4 className="font-medium">{key.replaceAll('_',' ')}{resume.conflicts?.includes(key)?' — conflicting values; review required':''}</h4>
      {rows.map((row,i)=><div key={i} className="mt-1 break-words rounded bg-raised p-3 text-sm"><p>{row.value}</p><p className="text-xs text-fg-muted">Page {row.page} · {row.method==='pdf_text'?'PDF text':row.method==='tesseract_ocr'?'OCR':row.method} · Evidence strength: {row.confidence>=.9?'high':row.confidence>=.8?'medium':'low'}</p><blockquote className="my-2 border-l border-line pl-2">{row.evidence}</blockquote>{onApply&&key!=='sea_service'&&<button type="button" className="underline" onClick={()=>onApply(key,row.value)}>Use this suggestion</button>}</div>)}
    </div>)}
    {!Object.keys(resume.fields||{}).length&&<p className="text-sm">No reliable field suggestions. Complete the candidate manually or hold for review.</p>}
  </section>
}
