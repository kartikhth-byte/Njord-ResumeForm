// Execute the real Edge Function handlers offline. External services are stubbed;
// SQL eligibility and identity evidence are covered by the companion PGlite suite.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { webcrypto } from 'node:crypto'

async function harness(name, options={}) {
  const p={id:'prospect',name:'Synthetic',organization_id:'org',email:'synthetic@example.invalid',email_normalized:'synthetic@example.invalid',status:'open'}
  const c={id:'case',prospect_id:p.id,organization_id:p.organization_id,status:'interview_passed'}
  const calls=[],mail=[],writes=[],links=[]
  function from(table) {
    const query={table,action:'read',values:null,filters:[]}
    const done=()=>{
      if(query.action!=='read'){writes.push({...query});return {data:{id:'request'}}}
      if(table==='prospects')return {data:p}
      if(table==='profiles')return {data:{id:'actor',full_name:'Synthetic Recruiter'}}
      if(table==='user_roles')return {data:[{roles:{name:'Recruiter'}}]}
      if(table==='recruitment_cases')return {data:name==='send-prospect-invite'?c:(options.cases??[c])}
      if(table==='applicant_magic_link_requests')return {data:[],count:options.count??0}
      throw new Error(`Unmodelled table ${table}`)
    }
    const chain={then(resolve,reject){return Promise.resolve(done()).then(resolve,reject)},select(){return chain},eq(k,v){query.filters.push([k,v]);return chain},is(){return chain},not(){return chain},in(){return chain},gte(){return chain},limit(){return chain},insert(values){query.action='insert';query.values=values;return chain},update(values){query.action='update';query.values=values;return chain},single:async()=>done(),maybeSingle:async()=>done()}
    return chain
  }
  const client={from,auth:{getUser:async()=>({data:{user:{id:'actor'}}}),admin:{generateLink:async args=>{links.push(args);return {data:{properties:{hashed_token:'synthetic-token'}}}}}},rpc:async(name,args)=>{
    calls.push({name,args})
    if(name==='has_permission')return {data:options.permitted!==false}
    if(name==='reserve_case_form_invite')return options.reserveError?{error:new Error('ineligible')}:{data:{invite_state:'sent',email:p.email,prospect_name:p.name}}
    if(name==='case_form_invite_eligible')return {data:options.eligible!==false,error:options.eligibilityError?new Error('eligibility unavailable'):null}
    if(name==='eligible_form_invite_prospects')return {data:options.matches??[p]}
    if(['release_prospect_invite_reservation','recruitment_case_record_form_invite','write_audit_event'].includes(name))return {data:{}}
    throw new Error(`Unmodelled RPC ${name}`)
  }}
  let handler
  const context=vm.createContext({Request,Response,URL,Date,crypto:webcrypto,console:{error(){}},setTimeout:fn=>{fn()},Deno:{env:{get:()=> 'synthetic'}},serve:fn=>{handler=fn},createAdminSupabaseClient:()=>client,createClient:()=>client,getPublicApiKey:()=> 'synthetic',getRuntimeSettings:async()=>({APP_URL:'https://holmes.example.invalid',RESEND_API_KEY:'synthetic',EMAIL_FROM:'test@example.invalid'}),getCorsHeaders:async()=>({}),BRAND:{sender:'Holmes'},claimTokenFingerprint:async()=> 'a'.repeat(64),fetch:async(url,init)=>{assert.equal(String(url),'https://api.resend.com/emails');mail.push(JSON.parse(init.body));return new Response(JSON.stringify({id:'synthetic-email'}),{status:options.mailFails?500:200})}})
  const source=fs.readFileSync(new URL(`../functions/${name}/index.ts`,import.meta.url),'utf8').replace(/^import .*\n/gm,'')
  vm.runInContext(stripTypeScriptTypes(source),context)
  const response=await handler(new Request('https://holmes.example.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify(name==='send-prospect-invite'?{prospectId:p.id,caseId:c.id,personalMessage:'Synthetic only'}:{email:p.email})}))
  return {response,calls,mail,writes,links}
}

test('reviewed open candidate invitation calls exact case reservation and eligibility before sending',async()=>{
 const r=await harness('send-prospect-invite');assert.equal(r.response.status,200);assert.equal(r.mail.length,1)
 assert.equal(r.calls.find(c=>c.name==='reserve_case_form_invite').args.p_case_id,'case')
 assert.equal(r.calls.find(c=>c.name==='case_form_invite_eligible').args.p_prospect,'prospect')
 assert.deepEqual(r.mail[0].to,['synthetic@example.invalid'])
 assert.deepEqual(r.mail[0].tags,[{name:'category',value:'prospect_invite'},{name:'prospect_id',value:'prospect'},{name:'actor_user_id',value:'actor'}])
 assert.equal(r.writes.find(w=>w.table==='applicant_magic_link_requests').values.case_id,'case')
})
test('denied permission, reservation failure and revoked/unavailable eligibility send no mail or sign-in token',async()=>{
 for(const options of [{permitted:false},{reserveError:true},{eligible:false},{eligibilityError:true}]){
  const r=await harness('send-prospect-invite',options);assert.ok(r.response.status>=400);assert.equal(r.mail.length,0);assert.equal(r.links.length,0)
 }
})
test('mail failure invalidates claim and releases reservation',async()=>{
 const r=await harness('send-prospect-invite',{mailFails:true});assert.equal(r.response.status,500)
 assert.ok(r.writes.some(w=>w.values?.request_status==='invalidated'))
 assert.ok(r.calls.some(c=>c.name==='release_prospect_invite_reservation'))
})
test('reissue supports reviewed open candidates and retains exact case',async()=>{
 const r=await harness('request-applicant-magic-link');assert.equal(r.response.status,200);assert.equal(r.mail.length,1)
 assert.ok(r.calls.some(c=>c.name==='eligible_form_invite_prospects'))
 assert.equal(r.writes.find(w=>w.action==='insert').values.case_id,'case')
})
test('suppressed, ambiguous and rate-limited reissues keep generic response and send nothing',async()=>{
 let expected
 for(const options of [{matches:[]},{matches:[{id:'a'},{id:'b'}]},{count:3},{cases:[]}]){
  const r=await harness('request-applicant-magic-link',options);assert.equal(r.response.status,200);assert.equal(r.mail.length,0);assert.equal(r.links.length,0)
  const body=await r.response.json();expected??=body;assert.deepEqual(body,expected)
 }
})
test('several eligible invitations retain explicit case selection',async()=>{
 const r=await harness('request-applicant-magic-link',{cases:[{id:'a'},{id:'b'}]});assert.equal(r.response.status,200);assert.equal(r.mail.length,1)
 assert.equal(r.writes.find(w=>w.action==='insert').values.case_id,null)
})
