import test from 'node:test'
import assert from 'node:assert/strict'
import { candidateAttachmentState, matchingCandidateLinks, groupCandidateAttachments, resumeReadiness } from '../src/utils/candidateDirectory.js'
const requirement = (id, company_id='c1', ship_id='s1', status='open') => ({id,company_id,ship_id,status})
const link = (r,status='sourced') => ({requirement:r,requirementId:r.id,status,stage:status})
const row = {id:'p1',attachedRequirements:[link(requirement('r1')),link(requirement('r2')),link(requirement('r3','c2','s2'),'contacted')]}
test('one person per ship, with all matching requirement links',()=>{
 const groups=groupCandidateAttachments([row], [{id:'c1',name:'A'},{id:'c2',name:'B'}],[{id:'s1',name:'One',company_id:'c1'},{id:'s2',name:'Two',company_id:'c2'}],{},'active')
 assert.equal(groups.length,2)
 assert.equal(groups[0].ships[0].candidates.length,1)
 assert.equal(groups[0].ships[0].candidates[0].links.length,2)
 assert.equal(groups[1].ships[0].candidates.length,1)
})
test('closed requirements and terminal cases are history; mixed cases remain attached',()=>{
 assert.equal(candidateAttachmentState(row),'attached')
 assert.equal(candidateAttachmentState({attachedRequirements:[link(requirement('r','c1','s1','closed'))]}),'unattached')
 assert.equal(candidateAttachmentState({attachedRequirements:[link(requirement('r'),'hired')]}),'unattached')
 assert.equal(candidateAttachmentState({attachedRequirements:[]}), 'unattached')
})
test('filters must match the same case and only matching links are rendered',()=>{
 assert.equal(matchingCandidateLinks(row,{company:'c1',stage:'contacted'}).length,0)
 assert.equal(matchingCandidateLinks(row,{company:'c2',stage:'contacted'}).length,1)
 const past={...row,attachedRequirements:[...row.attachedRequirements,link(requirement('past'),'withdrawn')]}
 assert.equal(matchingCandidateLinks(past,{},'history').length,1)
 assert.equal(matchingCandidateLinks(past,{},'all').length,4)
})
test('CV gate fails closed for unavailable and review states',()=>{
 assert.equal(resumeReadiness({original_available:true,status:'ready'}).ready,true)
 for(const status of [null,{original_available:false},{original_available:true,review_required:true},{original_available:true,status:'failed'}]) assert.equal(resumeReadiness(status).ready,false)
})
test('platform stored reviewed CV is ready even while indexing is queued',()=>{
 assert.equal(resumeReadiness({platform:true,storage_status:'stored',identity_status:'linked',indexing_status:'queued'}).ready,true)
 assert.equal(resumeReadiness({platform:true,storage_status:'stored',identity_status:'pending'}).ready,false)
 assert.equal(resumeReadiness({original_available:true,status:'pending'}).ready,false)
})
