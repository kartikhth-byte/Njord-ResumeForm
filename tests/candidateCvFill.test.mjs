import test from 'node:test'
import assert from 'node:assert/strict'
import { fillFromCv } from '../src/utils/candidateCvFill.js'

const empty = { name: '', email: '', telephone: '', rankId: '', vesselTypeId: '' }
test('labelled rank wins over table mentions and ordinals match', () => {
  const resume = { conflicts: ['present_rank'], fields: {
    present_rank: [{ value: 'Second Officer', confidence: .9 }, { value: 'Third Officer', confidence: .5 }],
    vessel_type: [{ value: 'Bulk Carrier', confidence: .9 }] } }
  const out = fillFromCv(empty, resume, [{ id: 'r2', name: '2nd Officer' }, { id: 'r3', name: '3rd Officer' }], [{ id: 'v1', name: 'Bulk carrier' }])
  assert.equal(out.rankId, 'r2'); assert.equal(out.vesselTypeId, 'v1')
})
test('equal-strength conflicts are left for the recruiter, typed values are kept', () => {
  const resume = { conflicts: ['present_rank'], fields: { full_name: [{ value: 'From CV', confidence: .5 }],
    present_rank: [{ value: 'Second Officer', confidence: .5 }, { value: 'Third Officer', confidence: .5 }] } }
  const out = fillFromCv({ ...empty, name: 'Typed' }, resume, [{ id: 'r2', name: 'Second Officer' }])
  assert.equal(out.rankId, ''); assert.equal(out.name, 'Typed')
})
test('applied-for rank fills when there is no present rank; CV spellings match stored ranks', () => {
  const resume = { conflicts: ['present_rank'], fields: { present_rank: [{ value: 'Wiper', confidence: .7 }, { value: 'Oiler', confidence: .5 }] } }
  assert.equal(fillFromCv(empty, resume, [{ id: 'w', name: 'Wiper' }, { id: 'o', name: 'Oiler' }]).rankId, 'w')
  const ab = { conflicts: [], fields: { present_rank: [{ value: 'Able Seaman', confidence: .5 }] } }
  assert.equal(fillFromCv(empty, ab, [{ id: 'ab', name: 'AB' }]).rankId, 'ab')
})
