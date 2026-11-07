import assert from 'node:assert/strict'
import {resumeIntakeHandler} from '../functions/resume-intake/handler.js'
import {dispatchOutbox} from '../functions/resume-intake/outbox.js'
const hash='a'.repeat(64),org='00000000-0000-4000-8000-0000000000a1',version='00000000-0000-4000-8000-000000000010'
let access={view:true,edit:true,search:true},pending=true,down=false,privateLeak=false
const writes=[],calls=[]
const values={resume_versions:{id:version,file_id:'file'},resume_files:{id:'file',content_hash:hash,drive_file_id:'private_drive_ref',size_bytes:100,storage_status:'stored'}}
const query=table=>({
 select(){return this},eq(){return this},order(){return this},limit(){return this},
 single(){return Promise.resolve({data:table==='needle_resume_evidence'?{id:'evidence'}:values[table]})},
 insert(row){writes.push([table,row]);return this},upsert(row){writes.push([table,row]);return this},update(row){writes.push([table,row]);return this},
 then(ok,no){return Promise.resolve({data:table==='resume_index_events'&&pending?[{id:'event',version_id:version,attempts:0}]:table==='prospect_resumes'?[{resume_id:hash}]:[]}).then(ok,no)},
})
const admin={auth:{getUser:async token=>({data:{user:token==='valid'?{id:'actor'}:null}})},from:query}
const deps={admin,requester:()=>({from:query,rpc:async()=>({data:[]})}),authorize:async()=>access,organization:org,intakeOrigin:'https://intake.example.invalid',needleOrigin:'https://needle.example.invalid',enabled:true,
 signIntake:async(user,claims,purpose)=>{calls.push({purpose,claims});return 'intake-signed'},signNeedle:async(user,claims,purpose)=>{calls.push({purpose,claims});return 'needle-signed'},
 fetcher:async(url,init)=>{
  const u=String(url)
  if(u.includes('/registered'))return new Response('{}',{status:down?503:200})
  if(u.includes('/prepare'))return Response.json({resumes:[{resume_id:hash,filename:'source.pdf',storage_ref:{drive_file_id:'private_drive_ref'},prefill:{full_name:'Approved Synthetic'}}]})
  const result={resume_id:hash,resume_version_id:version,filename:'source.pdf',fields:{},status:'needs_review',prefill:{}}
  privateLeak=JSON.stringify(init).includes('private_drive_ref')
  return Response.json(result)
 }}
const handler=resumeIntakeHandler(deps)
const req=(body,token='valid')=>new Request('https://holmes.example.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)})
assert.equal((await handler(req({action:'prepare',resume_ids:[hash]},'wrong'))).status,401)
access={view:true,edit:false,search:false,coordinator:true}
assert.equal((await handler(req({action:'prepare',resume_ids:[hash]}))).status,403)
assert.equal((await handler(req({action:'retry_extract',resume_version_id:version}))).status,403)
assert.equal(writes.length,0)
access={view:true,edit:true,search:true}
assert.equal((await handler(req({action:'prepare',resume_ids:[hash,hash]}))).status,400)
down=true
const r=await handler(req({action:'prepare',resume_ids:[hash]}));assert.equal(r.status,200)
const row=(await r.json()).resumes[0]
assert.equal(row.indexing_status,'delivery_pending');assert.equal(row.evidence_id,'evidence')
assert.equal(row.prefill.full_name,'Approved Synthetic')
assert.equal(JSON.stringify(row).includes('private_drive_ref'),false)
assert.equal(privateLeak,true) // The private reference is only transmitted server-to-server.
assert.equal(writes.some(([table])=>table==='prospects'),false)
pending=false
assert.equal((await handler(req({action:'prepare_version',resume_version_id:version}))).status,200)
const disabled=resumeIntakeHandler({...deps,enabled:false})
assert.equal((await disabled(req({action:'prepare_version',resume_version_id:version}))).status,503)
assert.equal((await disabled(req({action:'status',resume_version_id:version,prospect_id:'linked'}))).status,200)
pending=true;down=true
assert.deepEqual(await dispatchOutbox({...deps,needleOrigin:deps.needleOrigin}),{attempted:1,delivered:0,failed:1})
down=false
assert.deepEqual(await dispatchOutbox({...deps,needleOrigin:deps.needleOrigin}),{attempted:1,delivered:1,failed:0})
// Hash reuse consults only the signed source registry; no upload write occurs.
const uploaded=new Blob(['%PDF-synthetic'],{type:'application/pdf'})
const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await uploaded.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('')
let imports=0,uploads=0
values.resume_files.content_hash=digest
const resolver=resumeIntakeHandler({...deps,fetcher:async(url)=>{
 if(String(url).endsWith('/original-reference'))return Response.json({found:true,resume_id:digest,drive_file_id:'private_existing'})
 if(String(url).endsWith('/v1/import')){imports++;return Response.json({resume_id:digest,resume_version_id:version,filename:'test.pdf',fields:{},prefill:{},status:'needs_review'})}
 if(String(url).endsWith('/v1/upload'))uploads++
 return Response.json({})
}})
pending=false
const form=new FormData();form.set('file',uploaded,'synthetic.pdf')
assert.equal((await resolver(new Request('https://holmes.example.invalid',{method:'POST',headers:{Authorization:'Bearer valid'},body:form}))).status,200)
assert.equal(imports,1);assert.equal(uploads,0)
// More than one batch of poison events must not starve a later healthy event.
const backlog=Array.from({length:21},(_,i)=>({id:String(i).padStart(2,'0'),version_id:version,attempts:0,status:'pending',created_at:i}))
const attempted=[]
const fairAdmin={from(table){let orders=[],cap=20,patch=null,eventId=null;return {
 select(){return this},eq(key,value){if(key==='id')eventId=value;return this},
 order(key){orders.push(key);return this},limit(n){cap=n;return this},
 single(){return Promise.resolve({data:values[table]})},update(value){patch=value;return this},
 then(ok,no){if(patch)Object.assign(backlog.find(e=>e.id===eventId),patch)
 return Promise.resolve({data:patch?[]:backlog.filter(e=>e.status==='pending').sort((a,b)=>{for(const key of orders){if(a[key]<b[key])return -1;if(a[key]>b[key])return 1}return 0}).slice(0,cap)}).then(ok,no)},
 }}}
const fair={...deps,admin:fairAdmin,fetcher:async(_url,init)=>{const id=JSON.parse(init.body).event_id;attempted.push(id);return new Response('{}',{status:id==='20'?200:409})}}
assert.deepEqual(await dispatchOutbox(fair),{attempted:20,delivered:0,failed:20})
assert.deepEqual(await dispatchOutbox(fair),{attempted:20,delivered:1,failed:19})
assert.equal(attempted[20],'20')
assert.equal(backlog[20].status,'delivered')
console.log('Platform bridge/outbox: PASS (auth, Coordinator denial, server-only Drive refs, independent delivery failure/retry, evidence, disabled guard)')
