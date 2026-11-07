// Server-owned delivery retry. Storage succeeds independently of Needle health.
// Receiver deduplicates event IDs; competing retries are safe and never approve facts.
export async function dispatchOutbox({admin,organization,signNeedle,needleOrigin,fetcher=fetch,limit=20,allowLocal=false}) {
  const base=new URL(needleOrigin)
  if((base.protocol!=='https:'&&!(allowLocal&&base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('invalid_needle_origin')
  const checked=r=>{if(r.error)throw Error('outbox_unavailable');return r.data}
  // Least-attempted first: a permanently failing batch must not monopolize
  // every scheduled run. Created time/ID retain a stable order within a round.
  const events=checked(await admin.from('resume_index_events').select('id,version_id,attempts').eq('organization_id',organization).eq('status','pending').order('attempts').order('created_at').order('id').limit(limit))||[]
  let delivered=0,failed=0
  for(const event of events){
    try{
      const v=checked(await admin.from('resume_versions').select('file_id').eq('id',event.version_id).eq('organization_id',organization).single())
      const f=checked(await admin.from('resume_files').select('content_hash,drive_file_id,size_bytes').eq('id',v.file_id).eq('organization_id',organization).eq('storage_status','stored').single())
      const token=await signNeedle('00000000-0000-4000-8000-000000000001',{org:organization,role:'user',resume_ids:[f.content_hash]},'register')
      const response=await fetcher(new URL('/api/holmes/registered',base),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({event_id:event.id,event_type:'resume.registered',contract_version:1,organization_id:organization,resume_version_id:event.version_id,resume_id:f.content_hash,drive_file_id:f.drive_file_id,size_bytes:f.size_bytes})})
      if(!response.ok)throw Error('delivery_pending')
      checked(await admin.from('resume_index_events').update({status:'delivered',delivered_at:new Date().toISOString(),attempts:event.attempts+1,last_error_code:null}).eq('id',event.id).eq('organization_id',organization));delivered++
    }catch{
      checked(await admin.from('resume_index_events').update({attempts:event.attempts+1,last_error_code:'needle_delivery_pending'}).eq('id',event.id).eq('organization_id',organization).eq('status','pending'));failed++
    }
  }
  return {attempted:events.length,delivered,failed}
}
