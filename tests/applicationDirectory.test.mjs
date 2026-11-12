import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applicationPlacements, filterApplicationPlacements, groupApplicationPlacements, matchesLegacyApplicationStatus, readApplicationFilters } from '../src/utils/applicationDirectory.js'
import { loadApplicationDirectory } from '../src/services/applicationDirectoryService.js'
const app = {id:'a',prospect_id:'p',full_name:'Synthetic applicant',compliance_status:'red'}
const context = {cases:[{id:'x',application_id:'a',prospect_id:'p',requirement_id:'r1'}, {id:'y',application_id:'a',prospect_id:'p',requirement_id:'r2'}, {id:'z',application_id:'a',prospect_id:'p',requirement_id:'r3'}, {id:'other',application_id:'different-form',prospect_id:'p',requirement_id:'r4'}, {id:'wrong',application_id:'a',prospect_id:'other-person',requirement_id:'r4'}], requirements:[{id:'r1',company_id:'c1',ship_id:'s1',req_id_display:'REQ-1'},{id:'r2',company_id:'c1',ship_id:'s1',req_id_display:'REQ-2'},{id:'r3',company_id:'c2',ship_id:'s2',req_id_display:'REQ-3'}],companies:[{id:'c1',name:'Same name'},{id:'c2',name:'Same name'}],ships:[{id:'s1',name:'Same ship'},{id:'s2',name:'Same ship'}]}
test('explicit links, one form per ship, distinct identities and unmatched forms',()=>{
 const rows=applicationPlacements([app,{id:'b',prospect_id:'p'}],context)
 assert.equal(rows.length,3)
 assert.deepEqual(rows[0].links.map(l=>l.id),['x','y'])
 assert.equal(rows[2].companyName,'Not linked')
 assert.equal(groupApplicationPlacements(rows).length,3)
 assert.equal(groupApplicationPlacements(rows.filter(r=>r.companyId==='c1'))[0].count,1)
})
test('filters apply to the same linked placement and reveal only selected requirements',()=>{
 const rows=applicationPlacements([app],context)
 assert.equal(filterApplicationPlacements(rows,{company:'c1',requirement:'r3'}).length,0)
 assert.equal(filterApplicationPlacements(rows,{ship:'s1',q:'REQ-3'}).length,0)
 assert.deepEqual(filterApplicationPlacements(rows,{requirement:'r2'})[0].links.map(l=>l.id),['y'])
 assert.equal(filterApplicationPlacements(rows,{checks:'green'}).length,0)
})
test('linked missing metadata is distinct from not linked; legacy saved status and safe filter URLs',()=>{
 const rows=applicationPlacements([app],{...context,requirements:[]})
 assert.equal(rows[0].companyName,'Company not mapped')
 assert.equal(rows[0].links.length,3)
 assert.equal(matchesLegacyApplicationStatus('hired','hired'),true)
 assert.equal(matchesLegacyApplicationStatus('hired','all'),false)
 assert.equal(matchesLegacyApplicationStatus('withdrawn',''),true)
 assert.deepEqual(readApplicationFilters('broken'),{})
 assert.deepEqual(readApplicationFilters('{"position":[],"nationality":"indian","dateRange":{"from":"2026-11-01","to":"oops"},"unexpected":"x"}'),{nationality:'indian',dateRange:{from:'2026-11-01'}})
})
function clientFixture({failTable=''}={}) {
 const data={applications:Array.from({length:1001},(_,i)=>({id:`a${i}`,user_id:'u',prospect_id:'p',submitted_at:'2026-11-01'})),profiles:[{id:'u'}],recruitment_cases:[{id:'c',application_id:'a1000',prospect_id:'p',requirement_id:'r'}],requirements:[{id:'r',company_id:'co',ship_id:'s'}],client_companies:[{id:'co'}],client_ships:[{id:'s'}]}
 const calls=[]
 return {calls,from(table){let rows=data[table]||[];const query={select(){return this},not(...args){calls.push({table,not:args});return this},order(){return this},eq(){return this},gte(...args){calls.push({table,gte:args});return this},lte(...args){calls.push({table,lte:args});return this},in(field,ids){calls.push({table,field,ids});rows=rows.filter(r=>ids.includes(r[field]));return this},async range(a,b){calls.push({table,range:[a,b]});return table===failTable?{error:new Error('Synthetic failure')}:{data:rows.slice(a,b+1)}}};return query}}
}
test('directory pages past API cap and chunks exact link/profile lookups',async()=>{
 const client=clientFixture();const result=await loadApplicationDirectory(client,{dateRange:{from:'2026-11-01',to:'2026-11-12'}})
 assert.equal(result.applications.length,1001);assert.equal(result.cases.length,1)
 assert.equal(client.calls.filter(c=>c.table==='applications'&&c.range).length,3)
 assert.ok(client.calls.filter(c=>c.ids).every(c=>c.ids.length<=100))
 assert.ok(client.calls.some(c=>c.gte?.[0]==='submitted_at'))
 assert.ok(client.calls.some(c=>c.not?.[0]==='submitted_at'))
})
test('relationship read errors fail the directory instead of presenting everything as unlinked',async()=>{
 await assert.rejects(loadApplicationDirectory(clientFixture({failTable:'recruitment_cases'})),/Synthetic failure/)
})
