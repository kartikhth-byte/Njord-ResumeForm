import test from 'node:test'
import assert from 'node:assert/strict'
import {candidateCaseMatches} from '../src/utils/platformIntake.js'
import {buildRequirementTrackerRows,buildCandidateFunnelRows} from '../src/utils/kpiTracker.js'
test('company, ship and case stage must match the same case',()=>{
 const cases=[{prospect_id:'p',requirement_id:'r1',status:'sourced'},{prospect_id:'p',requirement_id:'r2',status:'offered'}]
 const reqs=[{id:'r1',company_id:'a',ship_id:'s1'},{id:'r2',company_id:'b',ship_id:'s2'}]
 assert.equal(candidateCaseMatches('p',cases,reqs,{company:'a',stage:'offered'}),false)
 assert.equal(candidateCaseMatches('p',cases,reqs,{company:'b',ship:'s2',stage:'offered'}),true)
 assert.equal(candidateCaseMatches('p',[],reqs,{}),true)
})
test('Draft does not contribute open positions or start the SLA',()=>{
 const [r]=buildRequirementTrackerRows({requirements:[{id:'draft',status:'draft',positions_required:2,target_days:30,date_opened:'2020-01-01'}]})
 assert.equal(r.openPositions,0);assert.equal(r.daysOpen,null);assert.equal(r.onTimeStatus,'—')
})

test('case-only candidate is attached and in process; an unattached person is not',()=>{
 const rows=buildCandidateFunnelRows({prospects:[{id:'p',name:'Synthetic'},{id:'unattached',name:'Synthetic pool'},{id:'legacy',name:'Synthetic legacy'}],requirements:[{id:'r',req_id_display:'Synthetic requirement'}],cases:[{id:'case',prospect_id:'p',requirement_id:'r',status:'sourced',updated_at:'2026-11-07'},{id:'legacy-case',prospect_id:'legacy',requirement_id:'r',status:'legacy',updated_at:'2026-11-07'}],casesAvailable:true})
 assert.equal(rows[0].requirementCount,1);assert.equal(rows[0].inActivePipeline,true);assert.equal(rows[0].stage,'Sourced')
 assert.equal(rows[1].requirementCount,0);assert.equal(rows[1].inActivePipeline,false)
 assert.equal(rows[2].stage,'Needs triage');assert.equal(rows[2].inActivePipeline,true)
})

test('candidate rows expose every attached requirement with its own stage',()=>{
 const [row]=buildCandidateFunnelRows({prospects:[{id:'p',name:'Synthetic'}],requirements:[{id:'r1',req_id_display:'ONE',company_id:'c1',ship_id:'s1'},{id:'r2',req_id_display:'TWO',company_id:'c2',ship_id:'s2'}],cases:[{id:'a',prospect_id:'p',requirement_id:'r1',status:'sourced'},{id:'b',prospect_id:'p',requirement_id:'r2',status:'offered'},{id:'old',prospect_id:'p',requirement_id:'r1',status:'closed'}],casesAvailable:true})
 assert.equal(row.attachedRequirements.length,2)
 assert.deepEqual(row.attachedRequirements.map(link=>[link.requirement.req_id_display,link.stage]),[['ONE','Sourced'],['TWO','Offered']])
})
