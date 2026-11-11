import test from 'node:test'
import assert from 'node:assert/strict'
import { groupRequirements } from '../src/utils/requirementGroups.js'

test('groups by IDs, uses current directory names and preserves saved requirement fields', () => {
  const rows = [
    {id:'r1',company_id:'c1',ship_id:'s1',customer_name:'Old company',vessel_name:'Old ship'},
    {id:'r2',company_id:'c1',ship_id:'s2'},
    {id:'r3',company_id:'c2',ship_id:'s3'},
  ]
  const groups = groupRequirements(rows, [{id:'c1',name:'Same name'},{id:'c2',name:'Same name'}], [
    {id:'s1',name:'Renamed ship',company_id:'c1'}, {id:'s2',name:'Ship two',company_id:'c1'},
    {id:'s3',name:'Renamed ship',company_id:'c2'},
  ])
  assert.equal(groups.length,2)
  assert.equal(groups[0].count,2)
  assert.equal(groups[0].ships.length,2)
  assert.equal(groups[0].ships[0].name,'Renamed ship')
  assert.equal(rows[0].vessel_name,'Old ship')
})
test('unmapped legacy labels cannot invent company or ship identities', () => {
  const groups = groupRequirements([{id:'a',customer_name:'Same',vessel_name:'Ship'},{id:'b',customer_name:'Same',vessel_name:'Ship'}])
  assert.equal(groups[0].id,'unmapped')
  assert.equal(groups[0].ships.length,2)
  assert.equal(groups[0].count,2)
})
test('archived and unavailable directory records remain visible; mismatched ship does not leak its label', () => {
  const groups = groupRequirements([{id:'r',company_id:'c',ship_id:'s',vessel_name:'Saved'}], [{id:'c',name:'Archived',archived_at:'today'}], [{id:'s',company_id:'other',name:'Not this company'}])
  assert.equal(groups[0].archived,true)
  assert.equal(groups[0].ships[0].name,'Saved')
  assert.equal(groupRequirements([]).length,0)
})
