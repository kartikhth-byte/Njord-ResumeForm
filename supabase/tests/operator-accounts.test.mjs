import assert from 'node:assert/strict'
import { operatorAccountsHandler } from '../functions/operator-accounts/handler.js'
const actor='00000000-0000-4000-8000-000000000001',target='00000000-0000-4000-8000-000000000002'
let operator=true,roles=['Recruiter'],failAuth=false;const order=[];const events=[]
const admin={auth:{getUser:async()=>({data:{user:{id:actor}}}),resetPasswordForEmail:async()=>{order.push('reset');return{}},admin:{getUserById:async()=>({data:{user:{id:target,email:'synthetic@example.invalid'}}}),updateUserById:async(_id,fields)=>{order.push(fields.ban_duration==='none'?'auth-enable':'auth-disable');return{error:failAuth?{}:null}}}},
 from(table){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:table==='profiles'?{id:target,user_type:'recruiter'}:null}),then(resolve,reject){return Promise.resolve({data:table==='user_roles'?roles.map(name=>({roles:{name}})):[]}).then(resolve,reject)},insert(row){events.push(row);return{select(){return this},single:async()=>({data:{id:1}})}},update(row){events.push(row);return{eq:async()=>({})}}}}}
const handler=operatorAccountsHandler({admin,authorize:async()=>operator,needleAccess:async(_actor,_target,disabled)=>order.push(disabled?'needle-disable':'needle-enable'),appUrl:'https://holmes.example.invalid'})
const request=(action,id=target)=>new Request('https://edge.example.invalid',{method:'POST',headers:{Authorization:'Bearer normal-session','Content-Type':'application/json'},body:JSON.stringify({action,user_id:id})})
operator=false;assert.equal((await handler(request('disable'))).status,403);assert.equal(order.length,0)
operator=true;assert.equal((await handler(request('disable',actor))).status,409)
roles=['Master Recruiter'];assert.equal((await handler(request('disable'))).status,409)
roles=['Recruiter'];assert.equal((await handler(request('disable'))).status,200);assert.deepEqual(order,['needle-disable','auth-disable'])
order.length=0;assert.equal((await handler(request('enable'))).status,200);assert.deepEqual(order,['auth-enable','needle-enable'])
order.length=0;failAuth=true;assert.equal((await handler(request('enable'))).status,503);assert.deepEqual(order,['auth-enable']);assert.equal(events.at(-1).status,'failed')
failAuth=false;order.length=0;assert.equal((await handler(request('reset'))).status,200);assert.deepEqual(order,['reset']);assert.equal(JSON.stringify(events).includes('password'),false)
console.log('Operator accounts: PASS (denied normal users, self/Master protection, fail-closed disable/enable ordering, reset without passwords, audited failure)')
