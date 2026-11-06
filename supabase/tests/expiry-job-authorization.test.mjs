import assert from 'node:assert/strict'
import { expiryJobCaller } from '../functions/process-expiry-warnings/authorization.js'
let operator = true
let lookupError = null
const admin = { auth: { getUser: async token => ({ data: { user: token === 'operator-token' || token === 'coordinator-token' ? { id: 'actor' } : null } }) }, from(table) {
  assert.equal(table, 'platform_operators')
  return { select() { return this }, eq(column, value) { assert.equal(column, 'user_id'); assert.equal(value, 'actor'); return this }, maybeSingle: async () => ({ data: operator ? { user_id: 'actor' } : null, error: lookupError }) }
} }
const headers = values => new Headers(values)
assert.equal((await expiryJobCaller(admin, headers({ authorization: 'Bearer jwt-service' }), 'jwt-service', false)).allowed, true)
assert.equal((await expiryJobCaller(admin, headers({ apikey: 'sb_secret_synthetic' }), 'sb_secret_synthetic', true)).allowed, true)
assert.equal((await expiryJobCaller(admin, headers({ authorization: 'Bearer sb_secret_synthetic' }), 'sb_secret_synthetic', true)).allowed, false)
assert.equal((await expiryJobCaller(admin, headers({ authorization: 'Bearer operator-token' }), 'sb_secret_synthetic', true)).allowed, true)
operator = false
assert.equal((await expiryJobCaller(admin, headers({ authorization: 'Bearer coordinator-token' }), 'sb_secret_synthetic', true)).allowed, false)
operator = true; lookupError = { code: 'database_unavailable' }
assert.equal((await expiryJobCaller(admin, headers({ authorization: 'Bearer operator-token' }), 'sb_secret_synthetic', true)).allowed, false)
console.log('Expiry job: PASS (operator lookup, normal-user denial, failed lookup, JWT and apikey-only modern service credentials)')
