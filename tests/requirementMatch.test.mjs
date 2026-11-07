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
