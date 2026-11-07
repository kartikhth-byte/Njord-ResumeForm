import test from 'node:test'
import assert from 'node:assert/strict'
import { attachedCase, matchAssessment, criterionLabel } from '../src/utils/requirementMatch.js'
test('Missing nationality is unverified, never an invented rating', () => {
  const row = { verdicts: [{family:'experience_ship_type',verdict:'PASS'}, {family:'nationality_match',verdict:'UNKNOWN'}] }
  assert.equal(matchAssessment(row),'1 of 2 criteria confirmed')
  assert.equal(criterionLabel('nationality_match'),'Nationality')
  assert.equal(matchAssessment({verdicts:[]}), 'Assessment unavailable')
})
test('Existing attachment belongs to this exact requirement', () => {
  const row = {cases:[{id:'other-case',requirement_id:'other'}, {id:'this-case',requirement_id:'current'}]}
  assert.equal(attachedCase(row,'current').id,'this-case')
  assert.equal(attachedCase(row,'absent'),undefined)
})

test('Row matching requires an open, reviewed, versioned rank and vessel scope', async () => {
  const { requirementMatchBlocker } = await import('../src/utils/requirementMatch.js')
  const eligible = { status:'open', company_id:'company', ship_id:'ship', location_reviewed_at:'2026-11-07', rank_id:'rank', vessel_type_id:'vessel', version:1 }
  assert.equal(requirementMatchBlocker(eligible), '')
  for (const status of ['draft', 'closed', 'cancelled']) assert.match(requirementMatchBlocker({...eligible,status}), /Open this requirement/)
  for (const field of ['company_id','ship_id','location_reviewed_at']) assert.match(requirementMatchBlocker({...eligible,[field]:null}), /Review the company and ship/)
  for (const field of ['rank_id','vessel_type_id']) assert.match(requirementMatchBlocker({...eligible,[field]:null}), /present rank and vessel type/)
  for (const field of ['deleted_at','archived_at','isArchived']) assert.notEqual(requirementMatchBlocker({...eligible,[field]:true}), '')
  assert.match(requirementMatchBlocker({...eligible,version:undefined}), /Refresh/)
  // Nationality is optional; it never prevents matching.
  assert.equal(requirementMatchBlocker({...eligible,nationality_id:null}), '')
})
