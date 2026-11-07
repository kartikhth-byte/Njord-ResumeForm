import assert from 'node:assert/strict'
import { integrationHandler } from '../functions/needle-integration/handler.js'
const hash='a'.repeat(64), reqId='00000000-0000-4000-8000-000000000002'
let access={view:true,edit:true,search:true}, status='open', version=3, calls=[]
const requirement=()=>({id:reqId,status,version,rank_id:'rank',vessel_type_id:'vessel',company_id:'company',ship_id:'ship',location_reviewed_at:'reviewed'})
function query(table) {
 const data=table==='requirements'?requirement():table==='client_ships'?{id:'ship'}:table==='client_companies'?{id:'company'}:table==='ranks'?{name:'Chief Officer'}:table==='vessel_types'?{name:'Bulk Carrier'}:table==='requirement_nationalities'?[{countries:{name:'India'}}]:table==='recruitment_cases'?[{id:'case',prospect_id:'person',requirement_id:reqId,status:'sourced'}]:[]
 return {select(){return this},eq(){return this},is(){return this},in(){return this},maybeSingle(){return Promise.resolve({data})},then(resolve,reject){return Promise.resolve({data}).then(resolve,reject)}}
}
const admin={auth:{getUser:async()=>({data:{user:{id:'normal-actor'}}})}}
const handler=integrationHandler({admin,requester:()=>({from:query,rpc:async()=>({data:[{id:'person',name:'Synthetic',reason:'resume'}]})}),authorize:async()=>access,
 origin:'https://needle.example.invalid',organization:'org',sign:async(user,claims,purpose)=>{calls.push({user,claims,purpose});return 'signed'},
 fetcher:async(url,init)=>{
  calls.push({path:new URL(url).pathname,body:JSON.parse(init.body)})
  if(String(url).endsWith('/match-original'))return new Response('%PDF-synthetic',{headers:{'Content-Type':'application/pdf'}})
  if(String(url).endsWith('/match-preview'))return Response.json({page:1,page_count:2,image:'iVBORw0KGgo=',storage_ref:'private'})
  return Response.json({stage_id:'saved-stage',total:1,offset:0,next_offset:null,path:'/search/private-project/chat',storage_ref:'private',rows:[{resume_id:hash,full_name:'Synthetic',public_bucket:'relevant_candidate',criteria_count:2,confirmed:1,verdicts:[{family:'nationality_match',verdict:'UNKNOWN'}],storage_ref:'private'}]})
 }})
const request=body=>new Request('https://holmes.example.invalid',{method:'POST',headers:{Authorization:'Bearer normal-session','Content-Type':'application/json'},body:JSON.stringify(body)})
const scope={requirement_id:reqId,expected_version:3}
const matched=await handler(request({...scope,action:'match',rank:'Forged rank'}))
assert.equal(matched.status,200)
const result=await matched.json()
assert.equal(result.rows[0].existing_candidate.id,'person')
assert.equal(result.rows[0].cases[0].requirement_id,reqId)
assert.equal(result.rows[0].public_bucket,'relevant_candidate')
assert.equal(result.path,'/search/private-project/chat');assert.equal('storage_ref' in result,false);assert.equal('storage_ref' in result.rows[0],false)
assert.equal(calls.at(-1).body.rank,'Chief Officer');assert.deepEqual(calls.at(-1).body.nationalities,['India'])
for(const action of ['match_results','match_original','match_preview']) {
 const response=await handler(request({...scope,action,stage_id:'saved-stage',resume_id:hash,offset:25,page:1}))
 assert.equal(response.status,200)
 assert.equal(calls.at(-2).purpose,'match')
 assert.equal(calls.at(-1).body.stage_id,'saved-stage')
 if(action!=='match_results')assert.deepEqual(calls.at(-2).claims.resume_ids,[hash])
 if(action==='match_preview')assert.deepEqual(await response.json(),{page:1,page_count:2,image:'iVBORw0KGgo='})
}
const before=calls.length
assert.equal((await handler(request({...scope,action:'match_results'}))).status,400)
assert.equal((await handler(request({...scope,action:'match',offset:-1}))).status,400)
assert.equal((await handler(request({...scope,action:'match_preview',stage_id:'saved-stage',resume_id:hash,page:0}))).status,400)
version=4;assert.equal((await handler(request({...scope,action:'match_original',stage_id:'saved-stage',resume_id:hash}))).status,409);version=3
status='draft';assert.equal((await handler(request({...scope,action:'match'}))).status,409);status='open'
access={view:true,edit:true,search:true,coordinator:true}
for(const action of ['match','match_results','match_original','match_preview'])assert.equal((await handler(request({...scope,action,stage_id:'saved-stage',resume_id:hash,page:1}))).status,403)
assert.equal(calls.length,before)
console.log('Requirement modal bridge: PASS (normal auth, version/open/role guards, exact scope, safe result projection, PDF)')
