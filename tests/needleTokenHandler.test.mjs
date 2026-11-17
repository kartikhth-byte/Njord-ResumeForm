import test from 'node:test'
import assert from 'node:assert/strict'
import { createNeedleTokenHandler } from '../supabase/functions/needle-token/handler.js'
import { needleCallerAccess } from '../supabase/functions/_shared/needle-access.js'

const origin = 'https://crewme.example'
const request = (method = 'POST', token = 'synthetic-token') => new Request(`${origin}/token`, {
  method, headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
})
function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
function fixture(options = {}) {
  const calls = []
  let clock = 0
  const data = {
    profiles: { full_name: 'Synthetic', email: 'test@example.invalid', user_type: options.applicant ? 'applicant' : 'recruiter' },
    user_roles: [{ roles: { name: options.role || 'Recruiter' } }],
    platform_operators: options.operator ? { user_id: 'synthetic-user' } : null,
  }
  const admin = {
    auth: { async getUser() {
      calls.push('auth')
      if (options.authWait) await options.authWait
      if (options.authThrow) throw Error('synthetic auth outage')
      return { data: { user: options.invalid ? null : { id: 'synthetic-user', email: 'fallback@example.invalid' } }, error: null }
    } },
    from(table) {
      const result = { data: data[table], error: options.failedTable === table ? Error('unavailable') : null }
      const query = { select() { return this }, eq() { return this },
        maybeSingle() { return Promise.resolve(result) }, then(...args) { return Promise.resolve(result).then(...args) },
        async insert() { calls.push('audit'); return { error: options.auditError ? Error('audit unavailable') : null } } }
      return query
    },
    async rpc() { return { data: true, error: null } },
  }
  const deps = {
    async getCorsHeaders() {
      calls.push('cors')
      if (options.corsWait) await options.corsWait
      if (options.corsThrow) throw Error('synthetic cors outage')
      return options.disallowed ? {} : { 'Access-Control-Allow-Origin': origin, 'Access-Control-Expose-Headers': 'Server-Timing' }
    },
    createAdminSupabaseClient: () => admin,
    async needleCallerAccess(...args) { calls.push('access'); return needleCallerAccess(...args) },
    async signNeedleToken(id, claims) {
      calls.push('sign')
      assert.equal(id, 'synthetic-user')
      assert.equal(claims.role, options.operator ? 'admin' : 'user')
      if (options.signError) throw Error('synthetic signer outage')
      return 'synthetic-signed-token'
    },
    env: key => key === 'NEEDLE_AI_SEARCH_ACCESS' ? options.mode || 'on' : undefined,
    now: () => ++clock,
    logError() {},
  }
  return { handler: createNeedleTokenHandler(deps), calls, deps }
}

test('CORS and auth overlap, signing waits for both and access', async () => {
  const cors = deferred()
  const auth = deferred()
  const { handler, calls } = fixture({ corsWait: cors.promise, authWait: auth.promise })
  const result = handler(request())
  assert.deepEqual(calls, ['cors', 'auth'])
  auth.resolve()
  await Promise.resolve()
  assert.ok(!calls.includes('access'))
  cors.resolve()
  const response = await result
  assert.equal(response.status, 200)
  assert.deepEqual(calls, ['cors', 'auth', 'access', 'sign'])
  assert.deepEqual(await response.json(), { token: 'synthetic-signed-token', expiresIn: 120 })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const timing = response.headers.get('server-timing')
  for (const phase of ['cors', 'auth', 'access', 'sign', 'total']) assert.match(timing, new RegExp(`${phase};dur=\\d+\\.\\d`))
  assert.doesNotMatch(timing, /synthetic|@|token/)
})

for (const allowed of [true, false]) test(`preflight caches only allowed origin: ${allowed}`, async () => {
  const { handler, calls } = fixture({ disallowed: !allowed })
  const response = await handler(request('OPTIONS'))
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-max-age'), allowed ? '300' : null)
  assert.deepEqual(calls, ['cors'])
})

for (const [label, opts, status] of [
  ['Recruiter', {}, 200], ['Master Recruiter', { role: 'Master Recruiter' }, 200],
  ['Operator', { operator: true }, 200], ['Coordinator', { role: 'Coordinator' }, 403],
  ['Applicant', { applicant: true }, 403], ['disabled', { mode: 'off', operator: true }, 403],
  ['invalid token', { invalid: true }, 401], ['permission lookup failure', { failedTable: 'user_roles' }, 500],
  ['audit failure', { operator: true, auditError: true }, 503], ['auth failure', { authThrow: true }, 500],
  ['CORS failure', { corsThrow: true }, 500], ['signing failure', { signError: true }, 500],
]) test(`handler preserves ${label} outcome`, async () => {
  const { handler, calls } = fixture(opts)
  const response = await handler(request())
  assert.equal(response.status, status)
  if (status !== 200 && !opts.signError) assert.ok(!calls.includes('sign'))
  if (opts.operator && status === 200) assert.ok(calls.indexOf('audit') < calls.indexOf('sign'))
  assert.equal(response.headers.get('access-control-max-age'), null)
})

test('missing authorization and wrong method do not query auth or permissions', async () => {
  for (const [req, status] of [[request('POST', ''), 401], [request('GET'), 405]]) {
    const { handler, calls } = fixture()
    assert.equal((await handler(req)).status, status)
    assert.deepEqual(calls, ['cors'])
  }
})

test('every POST rechecks origin, identity, access and operator audit', async () => {
  const { handler, calls } = fixture({ operator: true })
  await handler(request())
  await handler(request())
  assert.deepEqual(calls, ['cors', 'auth', 'access', 'audit', 'sign', 'cors', 'auth', 'access', 'audit', 'sign'])
})
