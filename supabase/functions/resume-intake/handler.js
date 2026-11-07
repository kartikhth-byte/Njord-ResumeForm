// Browser -> authenticated platform API -> private registry/Drive service.
// Needle remains an original-reference/search consumer, never the uploader.
export function resumeIntakeHandler({ admin, requester, authorize, signIntake, signNeedle, organization, intakeOrigin, needleOrigin, enabled, fetcher = fetch, allowLocal = false }) {
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}})
  const checked=r=>{if(r.error)throw new Error('registry_unavailable');return r.data}
  const origin=value=>{const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(allowLocal&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw Error('invalid_service_origin');return u}
  const remote=async(base,path,token,{body,method='POST'}={})=>{
    const response=await fetcher(new URL(path,base),{method,redirect:'error',headers:{Authorization:'Bearer '+token,...(body instanceof FormData||!body?{}:{'Content-Type':'application/json'})},body:method==='GET'?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(150000)})
    if(!response.ok)throw Error('intake_service_unavailable')
    return response
  }
  const fileVersion=async(version)=>{
    const v=checked(await admin.from('resume_versions').select('id,file_id,candidate_id,identity_status').eq('organization_id',organization).eq('id',version).single())
    const f=checked(await admin.from('resume_files').select('id,content_hash,drive_file_id,size_bytes,storage_status').eq('organization_id',organization).eq('id',v.file_id).single())
    return {v,f}
  }
  const deliver=async(actor,version,base)=>{
    const {v,f}=await fileVersion(version)
    const events=checked(await admin.from('resume_index_events').select('id,contract_version,version_id').eq('organization_id',organization).eq('version_id',version).eq('status','pending'))||[]
    if(!events.length&&v.identity_status!=='linked')return 'awaiting_identity_review'
    for(const event of events){
      try{
        const token=await signNeedle(actor,{org:organization,role:'user',resume_ids:[f.content_hash]},'register')
        await remote(base,'/api/holmes/registered',token,{body:{event_id:event.id,contract_version:1,event_type:'resume.registered',organization_id:organization,
          resume_version_id:version,resume_id:f.content_hash,drive_file_id:f.drive_file_id,size_bytes:f.size_bytes}})
        checked(await admin.from('resume_index_events').update({status:'delivered',delivered_at:new Date().toISOString(),last_error_code:null}).eq('id',event.id).eq('organization_id',organization))
      }catch{
        checked(await admin.from('resume_index_events').update({last_error_code:'needle_delivery_pending'}).eq('id',event.id).eq('organization_id',organization))
        return 'delivery_pending'
      }
    }
    return 'queued'
  }
  const evidence=async(actor,row,source,stage)=>{
    if(!/^[a-f0-9]{64}$/.test(row.resume_id||'')||!row.resume_version_id)throw Error('invalid_platform_response')
    const {f}=await fileVersion(row.resume_version_id)
    if(f.content_hash!==row.resume_id||f.storage_status!=='stored')throw Error('invalid_registry_scope')
    checked(await admin.from('needle_resume_registry').upsert({organization_id:organization,resume_id:row.resume_id,filename:row.filename,
      status:'pending',original_available:true,engine_version:null,facts_revision:null,verified_at:new Date().toISOString()},{onConflict:'organization_id,resume_id'}))
    const e=checked(await admin.from('needle_resume_evidence').insert({organization_id:organization,resume_id:row.resume_id,actor_id:actor,source,stage_id:stage||null}).select('id').single())
    return {...row,evidence_id:e.id}
  }
  return async req=>{
    if(req.method!=='POST')return json({error:'Method not allowed'},405)
    const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'')
    const auth=await admin.auth.getUser(token);if(auth.error||!auth.data.user)return json({error:'Sign in required'},401)
    const user=auth.data.user,access=await authorize(user.id),client=requester(token)
    if(!access?.view)return json({error:'Not authorized'},403)
    let body,form
    try{
      if(req.headers.get('content-type')?.includes('multipart/form-data')){
        if(Number(req.headers.get('content-length')||0)>10485760+65536)return json({error:'PDF must be 10 MB or smaller'},413)
        form=await req.formData();body={action:'upload'}
        const f=form.get('file');if(!f||typeof f==='string'||f.size>10485760)return json({error:'Choose a PDF, 10 MB or smaller'},400)
      }else body=await req.json()
    }catch{return json({error:'Invalid request'},400)}
    if(!body||typeof body!=='object'||Array.isArray(body)||!['upload','prepare','prepare_version','retry_extract','review_original','view','status','retry_index'].includes(body.action))return json({error:'Invalid action'},400)
    const action=body.action
    if(!['view','status'].includes(action)&&(!access.edit||(access.coordinator&&!access.operator)))return json({error:'Not authorized'},403)
    if(action==='prepare'&&!access.search)return json({error:'AI search access required'},403)
    if(!enabled&&!['view','status','review_original'].includes(action))return json({error:'Platform Resume Intake is not enabled'},503)
    const intake=origin(intakeOrigin),needle=origin(needleOrigin)
    if(['view','status','retry_index'].includes(action)){
      const {v,f}=await fileVersion(body.resume_version_id)
      const linked=checked(await client.from('prospect_resumes').select('resume_id').eq('organization_id',organization).eq('prospect_id',body.prospect_id).eq('resume_id',f.content_hash))
      if(!linked?.length)return json({error:'Résumé not found'},404)
      if(action==='retry_index')return json({indexing_status:await deliver(user.id,v.id,needle)})
      if(action==='status'){
        const extraction=checked(await admin.from('resume_extractions').select('status').eq('version_id',v.id).order('created_at',{ascending:false}).limit(1))||[]
        const delivery=checked(await admin.from('resume_index_events').select('status').eq('organization_id',organization).eq('version_id',v.id))||[]
        let processing='not_observed'
        try{
          const signed=await signNeedle(user.id,{org:organization,role:'viewer',resume_ids:[f.content_hash]},'view')
          const result=await (await remote(needle,'/api/holmes/resumes/'+f.content_hash+'/status',signed,{method:'GET'})).json()
          processing=['pending','ready','failed'].includes(result.status)?result.status:'not_observed'
        }catch{ /* Independent indexing outage does not hide a stored original. */ }
        return json({platform:true,resume_version_id:v.id,resume_id:f.content_hash,storage_status:f.storage_status,identity_status:v.identity_status,
          basic_extraction_status:extraction[0]?.status||'not_observed',indexing_status:!delivery.length&&v.identity_status!=='linked'?'awaiting_identity_review':delivery.some(e=>e.status==='pending')?'delivery_pending':processing==='ready'?'indexed':processing==='failed'?'review_required':'queued'})
      }
      const signed=await signIntake(user.id,{org:organization,role:'viewer',resume_version_id:v.id},'view')
      const pdf=await remote(intake,'/v1/versions/'+v.id+'/pdf',signed,{method:'GET'})
      if(!pdf.headers.get('content-type')?.startsWith('application/pdf'))throw Error('original_not_pdf')
      return new Response(pdf.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="resume.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
    }
    if(action==='review_original'){
      const {v}=await fileVersion(body.resume_version_id)
      const signed=await signIntake(user.id,{org:organization,role:'user',resume_version_id:v.id},'view')
      const pdf=await remote(intake,'/v1/versions/'+v.id+'/pdf',signed,{method:'GET'})
      if(!pdf.headers.get('content-type')?.startsWith('application/pdf'))throw Error('original_not_pdf')
      return new Response(pdf.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="resume.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
    }
    let rows=[]
    if(action==='retry_extract'){
      const {v}=await fileVersion(body.resume_version_id)
      const signed=await signIntake(user.id,{org:organization,role:'user',resume_version_id:v.id},'extract')
      rows=[await (await remote(intake,'/v1/versions/'+v.id+'/extract',signed,{body:{}})).json()]
    }else if(action==='prepare_version'){
      const {v,f}=await fileVersion(body.resume_version_id)
      const extraction=checked(await admin.from('resume_extractions').select('payload').eq('version_id',v.id).order('created_at',{ascending:false}).limit(1))||[]
      const payload=extraction[0]?.payload
      rows=[{resume_id:f.content_hash,resume_version_id:v.id,filename:'resume.pdf',status:payload?.status||'failed',
        original_available:true,fields:payload?.fields||{},conflicts:payload?.conflicts||[],warnings:payload?.warnings||[],
        page_count:payload?.page_count,extractor_version:payload?.extractor_version,contract_version:payload?.contract_version,prefill:{}}]
    }else if(action==='upload'){
      const file=form.get('file')
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('')
      const existing=checked(await admin.from('resume_files').select('id').eq('organization_id',organization).eq('content_hash',digest).limit(1))||[]
      let source
      if(!existing.length){
        // Resolve the existing corpus by metadata before writing another Drive
        // original. An unavailable lookup fails loudly; it is never "not found".
        const signed=await signNeedle(user.id,{org:organization,role:'user',resume_ids:[digest]},'source_reference')
        source=await (await remote(needle,'/api/holmes/original-reference',signed,{body:{resume_id:digest}})).json()
        if(typeof source.found!=='boolean'||(source.found&&(source.resume_id!==digest||typeof source.drive_file_id!=='string')))throw Error('canonical_original_lookup_failed')
      }
      if(source?.found){
        const signed=await signIntake(user.id,{org:organization,role:'user',resume_ids:[digest]},'import')
        rows=[await (await remote(intake,'/v1/import',signed,{body:{resume_id:digest,drive_file_id:source.drive_file_id,filename:file.name}})).json()]
      }else{
        const signed=await signIntake(user.id,{org:organization,role:'user'},'upload')
        rows=[await (await remote(intake,'/v1/upload',signed,{body:form})).json()]
      }
      if(rows[0]?.resume_id!==digest)throw Error('uploaded_source_hash_mismatch')
    }else{
      const ids=body.resume_ids
      if(!Array.isArray(ids)||!ids.length||ids.length>25||ids.some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))||new Set(ids).size!==ids.length)return json({error:'Choose 1–25 different résumés'},400)
      const signed=await signNeedle(user.id,{org:organization,role:'user',resume_ids:ids},'prepare')
      const prepared=await (await remote(needle,'/api/holmes/prepare',signed,{body:{resume_ids:ids,stage_id:body.stage_id||null}})).json()
      if(!Array.isArray(prepared.resumes)||prepared.resumes.length!==ids.length||new Set(prepared.resumes.map(r=>r.resume_id)).size!==ids.length)throw Error('source_scope_mismatch')
      for(const source of prepared.resumes){
        if(!ids.includes(source.resume_id)||!source.storage_ref?.drive_file_id)throw Error('canonical_original_reference_unavailable')
        const signed=await signIntake(user.id,{org:organization,role:'user',resume_ids:[source.resume_id]},'import')
        const imported=await (await remote(intake,'/v1/import',signed,{body:{resume_id:source.resume_id,drive_file_id:source.storage_ref.drive_file_id,filename:source.filename}})).json()
        if(imported.resume_id!==source.resume_id)throw Error('imported_source_hash_mismatch')
        rows.push({...imported,prefill:source.prefill||{},approved_facts_prefill:true})
      }
    }
    const results=[]
    for(const row of rows){
      const verified=await evidence(user.id,row,action==='upload'?'holmes_upload':'needle_search',action==='prepare'?body.stage_id:null)
      const matches=checked(await client.rpc('find_resume_candidate_matches',{p_resume_id:row.resume_id}))||[]
      const indexing_status=await deliver(user.id,row.resume_version_id,needle)
      results.push({...verified,matches,indexing_status})
    }
    return json({resumes:results})
  }
}
