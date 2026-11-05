import test from 'node:test'
import assert from 'node:assert/strict'
import { needleRoleFor } from '../supabase/functions/_shared/needle-access.js'

const recruiter = { userType: 'recruiter', roleNames: ['Recruiter'] }

test('off: nobody gets a token, operators included', () => {
  assert.equal(needleRoleFor({ access: 'off', isOperator: true }), null)
  assert.equal(needleRoleFor({ access: undefined, ...recruiter }), null)
})

test('operator mode: only operators, as admin', () => {
  assert.equal(needleRoleFor({ access: 'operator', isOperator: true }), 'admin')
  assert.equal(needleRoleFor({ access: 'operator', ...recruiter }), null)
})

test('on: operators admin, recruiters user, coordinators never', () => {
  assert.equal(needleRoleFor({ access: 'on', isOperator: true, ...recruiter }), 'admin')
  assert.equal(needleRoleFor({ access: 'on', ...recruiter }), 'user')
  assert.equal(needleRoleFor({ access: 'on', userType: 'recruiter', roleNames: ['Master Recruiter'] }), 'user')
  assert.equal(needleRoleFor({ access: 'on', userType: 'recruiter', roleNames: ['Coordinator'] }), null)
  assert.equal(needleRoleFor({ access: 'on', userType: 'applicant', roleNames: ['Recruiter'] }), null)
})

test('a Coordinator row blocks the token whatever the other rows are', () => {
  assert.equal(
    needleRoleFor({ access: 'on', userType: 'recruiter', roleNames: ['Coordinator', 'Recruiter'] }),
    null,
  )
  assert.equal(
    needleRoleFor({ access: 'on', userType: 'recruiter', roleNames: ['Recruiter', 'Coordinator'] }),
    null,
  )
})

test('operators still get admin with a Coordinator row', () => {
  assert.equal(needleRoleFor({ access: 'on', isOperator: true, roleNames: ['Coordinator'] }), 'admin')
})
