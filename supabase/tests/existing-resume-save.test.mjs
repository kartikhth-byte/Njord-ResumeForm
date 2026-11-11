import assert from 'node:assert/strict'
import {integrationHandler} from '../functions/needle-integration/handler.js'
const actor='00000000-0000-4000-8000-000000000001', ev='00000000-0000-4000-8000-000000000002'
const receipt='00000000-0000-4000-8000-000000000003', hash='a'.repeat(64), revision='sha256:'+'b'.repeat(64)
let access={view:true,edit:true,search:true}, evidence={id:ev,actor_id:actor,resume_id:hash,facts_revision:revision}
let saveError=null
let response, writes=[], calls=[], rpc=[]
const query=table=>({select(){return this},eq(key,value){calls.push([key,value]);return this},
 maybeSingle:async()=>({data:evidence}),insert(row){writes.push({table,row});return {select(){return this},single:async()=>({data:{id:receipt}})}}})
const handler=integrationHandler({admin:{auth:{getUser:async()=>({data:{user:{id:actor}}})},from:query},
 requester:()=>({rpc:async(name,args)=>{rpc.push({name,args});return {data:{prospect_id:'saved'},error:saveError}}}),
 authorize:async()=>access,sign:async()=> 'signed',origin:'https://needle.example.invalid',organization:'org',
 fetcher:async(url,init)=>{calls.push([String(url),JSON.parse(init.body)]);return response},})
const body={action:'review_existing',p_evidence:ev,p_decision:'new',p_fields:{name:'Synthetic',email:'synthetic@example.invalid'},p_confirm_new:false,p_requirement:null,p_link:null,p_requirement_version:null}
const run=(value=body)=>handler(new Request('https://holmes.example.invalid',{method:'POST',headers:{authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify(value)}))
const ready=overrides=>new Response(JSON.stringify({resume_id:hash,facts_revision:revision,original_verified:true,verified_at:new Date().toISOString(),...overrides}))
for(const bad of [{p_evidence:'bad'},{p_fields:[]},{p_fields:null},{p_confirm_new:'yes'},{p_requirement:ev,p_requirement_version:null}])assert.equal((await run({...body,...bad})).status,400)
access={...access,coordinator:true};assert.equal((await run()).status,403);access={...access,coordinator:false}
response=new Response('{}',{status:409});assert.equal((await run()).status,409)
response=new Response('{}',{status:503});assert.equal((await run()).status,503)
for(const bad of [{facts_revision:'other'},{resume_id:'c'.repeat(64)},{original_verified:false},{verified_at:'invalid'},{verified_at:new Date(Date.now()-61000).toISOString()},{verified_at:new Date(Date.now()+60000).toISOString()}]){
 response=ready(bad);assert.equal((await run()).status,409)
}
assert.equal(writes.length,0);assert.equal(rpc.length,0)
response=ready();assert.equal((await run()).status,200)
assert.equal(writes.length,1);assert.equal(writes[0].table,'existing_resume_save_receipts')
assert.equal(writes[0].row.actor_id,actor);assert.equal(writes[0].row.facts_revision,revision)
assert.equal(rpc[0].name,'review_existing_resume');assert.equal(rpc[0].args.p_receipt,receipt)
assert.deepEqual(writes[0].row.reviewed_request,Object.fromEntries(Object.entries(body).filter(([k])=>k!=='action')))
assert(calls.some(([k,v])=>k==='actor_id'&&v===actor))
assert(calls.some(([k,v])=>k==='https://needle.example.invalid/api/holmes/verify-review'&&v.facts_revision===revision))
for(const message of ['possible_duplicate_requires_review','existing_candidate_requires_explicit_link','linked_candidate_requires_restore']) {
 saveError={message};response=ready();const denied=await run();assert.equal(denied.status,409);assert.equal((await denied.json()).error,message)
}
evidence=null;assert.equal((await run()).status,409)
console.log('PASS: final-save identity scope, mandatory fresh original/facts verification, fail-closed errors, private bound receipt, normal caller save')
