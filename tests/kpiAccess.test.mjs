import assert from 'node:assert/strict'
import test from 'node:test'
import { canViewKpi } from '../src/utils/kpiAccess.js'

test('all three recruiter roles can read KPI', () => {
  for (const role of ['Master Recruiter', 'Recruiter', 'Coordinator']) {
    assert.equal(canViewKpi(role), true)
  }
})

test('KPI access does not require an export or audit permission', () => {
  assert.equal(canViewKpi('Coordinator', ['view_requirements', 'view_prospects']), true)
  assert.equal(canViewKpi(null, ['export_csv']), false)
})

test('an explicit analytics permission still allows a custom role', () => {
  assert.equal(canViewKpi('Custom', ['view_analytics']), true)
  assert.equal(canViewKpi('Custom', ['view_audit_log']), true)
  assert.equal(canViewKpi('Custom'), false)
})
