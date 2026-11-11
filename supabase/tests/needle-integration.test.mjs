import assert from 'node:assert/strict'
import { integrationHandler } from '../functions/needle-integration/handler.js'
const hash='a'.repeat(64)
const org='00000000-0000-4000-8000-0000000000a1'
const writes=[];const calls=[]
let access={view:true,edit:true,search:true,coordinator:false}
let linked=true
const sameFile=[{id:'existing-person',name:'Existing synthetic',reason:'resume'}]
const rpcCalls=[]
const query=(table)=>({
 select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:null})},
 then(resolve,reject){return Promise.resolve({data: table==='prospect_resumes'&&linked?[{resume_id:hash}]:[]}).then(resolve,reject)},
 upsert(row){writes.push([table,row]);return Promise.resolve({data:null})},
 insert(row){writes.push([table,row]);return {select(){return this},single(){return Promise.resolve({data:{id:'evidence-uuid'}})}}}
})
const admin={auth:{getUser:async token=>({data:{user:token==='valid'?{id:'actor'}:null}})},from:query}
let upstream=()=>new Response(JSON.stringify({resumes:[{resume_id:hash,filename:'synthetic.pdf',status:'ready',facts_revision:'synthetic-revision',original_available:true,prefill:{full_name:'Synthetic'}}]}),{headers:{'Content-Type':'application/json'}})
const handler=integrationHandler({admin,requester:()=>({from:query,rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:sameFile}}}),authorize:async()=>access,
 origin:'https://needle.example.invalid',organization:org,
 sign:async(user,claims,purpose)=>{calls.push({user,claims,purpose});return 'signed'},
 fetcher:async(url,init)=>{calls.push({url:String(url),method:init.method});return upstream()},
})
const req=body=>new Request('https://holmes.example.invalid',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify(body)})
assert.equal((await handler(new Request('https://holmes.example.invalid',{method:'POST',headers:{Authorization:'Bearer wrong'},body:'{}'}))).status,401)
access={...access,coordinator:true}
assert.equal((await handler(req({action:'prepare',resume_ids:[hash]}))).status,403)
assert.equal(writes.length,0)
access={...access,coordinator:false}
assert.equal((await handler(req(null))).status,400)
assert.equal((await handler(req([]))).status,400)
assert.equal((await handler(req({action:'prepare',resume_ids:[hash,hash]}))).status,400)
assert.equal((await handler(req({action:'prepare',resume_ids:['../foreign']}))).status,400)
const good=await handler(req({action:'prepare',resume_ids:[hash],prefill:{full_name:'Forged'}}))
assert.equal(good.status,200)
const prepared=(await good.json()).resumes[0]
assert.equal(prepared.prefill.full_name,'Synthetic')
assert.equal(prepared.review_source,'existing_resume')
assert.deepEqual(prepared.matches,sameFile)
assert.deepEqual(rpcCalls,[{name:'find_resume_candidate_matches',args:{p_resume_id:hash}}])
assert.equal(writes.length,2)
assert.equal(writes[1][1].actor_id,'actor')
assert.deepEqual(calls[0].claims.resume_ids,[hash])
assert.equal(calls[0].purpose,'prepare')
assert.equal('prefill' in writes[0][1],false)
linked=false
assert.equal((await handler(req({action:'view',prospect_id:'other',resume_id:hash}))).status,404)
linked=true;access={view:true,edit:false,search:false,coordinator:true}
upstream=()=>new Response('%PDF-synthetic',{headers:{'Content-Type':'application/pdf'}})
const pdf=await handler(req({action:'view',prospect_id:'linked',resume_id:hash}))
assert.equal(pdf.status,200);assert.equal(pdf.headers.get('Content-Type'),'application/pdf')
assert.equal(calls.at(-2).purpose,'view');assert.equal(calls.at(-2).claims.role,'viewer')
upstream=()=>new Response('redirect',{status:503})
access={view:true,edit:true,search:true,coordinator:false}
const before=writes.length
assert.equal((await handler(req({action:'prepare',resume_ids:[hash]}))).status,503)
assert.equal(writes.length,before)
for (const row of [
 {resume_id:hash,status:'pending',original_available:true,facts_revision:'r1'},
 {resume_id:hash,status:'ready',original_available:false,facts_revision:'r1'},
 {resume_id:hash,status:'ready',original_available:true},
]) {
 upstream=()=>new Response(JSON.stringify({resumes:[row]}))
 assert.equal((await handler(req({action:'prepare',resume_ids:[hash]}))).status,409)
 assert.equal(writes.length,before)
}
for (const resumes of [[],[{resume_id:'b'.repeat(64)}],[{resume_id:hash},{resume_id:hash}]]) {
 upstream=()=>new Response(JSON.stringify({resumes}))
 await assert.rejects(()=>handler(req({action:'prepare',resume_ids:[hash]})),/Invalid Needle response/)
 assert.equal(writes.length,before)
}
upstream=()=>new Response(JSON.stringify({resumes:[{resume_id:hash,status:'ready',original_available:true,facts_revision:'r1',storage_ref:{drive_file_id:'private'}}]}))
const safe=(await (await handler(req({action:'prepare',resume_ids:[hash]}))).json()).resumes[0]
assert.equal('storage_ref' in safe,false)
console.log('Needle integration bridge: PASS (normal auth, Coordinator denial, bounded IDs, server-only prefill, linked-only PDF and upstream failure)')
