import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanupProblemScreenshots, cleanupHandler } from '../supabase/functions/cleanup-problem-screenshots/handler.js'
const id='00000000-0000-4000-8000-000000000011', owner='00000000-0000-4000-8000-000000000001'
function fixture({removeError=false, markError=false,queryError=false, badPath=false}={}) {
 const calls=[]
 const admin={from(table){assert.equal(table,'problem_reports');return{
  select(){return {is(...args){calls.push(['query-is',...args]);return this},or(value){calls.push(['or',value]);return this},order(){return this},async limit(){return {data:[{id,screenshot_path:badPath?'unrelated/file':`${owner}/${id}.png`}],error:queryError}}}},
  update(value){calls.push(['mark',value]);return {eq(){return this},async is(){return {error:markError}}}}
 }}, storage:{from(bucket){assert.equal(bucket,'problem-screenshots');return {async remove(paths){calls.push(['remove',paths]);return {error:removeError}}}}}}
 return {admin,calls}
}
test('deletes physical object before marking expiry; retains report history',async()=>{const {admin,calls}=fixture();assert.deepEqual(await cleanupProblemScreenshots(admin,new Date('2026-11-13T00:00:00Z')),{selected:1,deleted:1,failed:0});assert.ok(calls.find(c=>c[0]==='or')[1].includes('2026-11-12T23:00:00.000Z'));assert.ok(calls.findIndex(c=>c[0]==='remove')<calls.findIndex(c=>c[0]==='mark'))})
test('storage failure retains deletion eligibility for retry',async()=>{const {admin,calls}=fixture({removeError:true});assert.equal((await cleanupProblemScreenshots(admin)).failed,1);assert.ok(!calls.some(c=>c[0]==='mark'))})
test('mark failure is reported for retry',async()=>{assert.equal((await cleanupProblemScreenshots(fixture({markError:true}).admin)).failed,1)})
test('refuses unexpected paths and query failures',async()=>{const f=fixture({badPath:true});assert.equal((await cleanupProblemScreenshots(f.admin)).failed,1);assert.ok(!f.calls.some(c=>c[0]==='remove'));await assert.rejects(()=>cleanupProblemScreenshots(fixture({queryError:true}).admin))})
test('cleanup requires its dedicated credential, method and configured secret',async()=>{const token='x'.repeat(40),f=fixture(),handler=cleanupHandler({...f,token});assert.equal((await handler(new Request('https://example.invalid',{method:'POST'}))).status,401);assert.equal((await handler(new Request('https://example.invalid'))).status,405);assert.equal((await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:`Bearer ${token}`}}))).status,200);assert.equal((await cleanupHandler({...f,token:''})(new Request('https://example.invalid',{method:'POST'}))).status,401)})
