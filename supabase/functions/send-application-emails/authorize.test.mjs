import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeSubmissionNotification } from './authorize.ts'

function fixture({ user = { id: 'synthetic-applicant' }, authError = null,
  application = { id: 'synthetic-application', user_id: 'synthetic-applicant', submitted_at: '2026-11-06T12:00:00Z' },
  queryError = null } = {}) {
  const calls = { auth: 0, queries: 0, filters: [] }
  const admin = {
    auth: { getUser: async token => {
      calls.auth++
      assert.equal(token, 'synthetic-user-jwt')
      return { data: { user }, error: authError }
    } },
    from(table) {
      calls.queries++
      assert.equal(table, 'applications')
      return {
        select() { return this },
        eq(column, value) { calls.filters.push([column, value]); return this },
        not(column, operator, value) { calls.filters.push([column, operator, value]); return this },
        async single() { return { data: application, error: queryError } },
      }
    },
  }
  const run = (authorization = 'Bearer synthetic-user-jwt', applicationId = 'synthetic-application', apikey = 'sb_publishable_synthetic') =>
    authorizeSubmissionNotification(new Request('https://synthetic.invalid', {
      headers: { ...(authorization ? { Authorization: authorization } : {}), apikey },
    }), applicationId, admin, { 'Access-Control-Allow-Origin': 'http://localhost:3000' })
  return { run, calls }
}

test('missing or malformed bearer cannot query applications', async () => {
  for (const header of [null, 'Basic synthetic', 'Bearer ', 'Bearer two tokens']) {
    const f = fixture()
    const { response, application } = await f.run(header)
    assert.equal(response.status, 401)
    assert.equal(application, null)
    assert.deepEqual(f.calls, { auth: 0, queries: 0, filters: [] })
  }
})

test('invalid user session fails before querying an application', async () => {
  const f = fixture({ user: null, authError: { message: 'Invalid token' } })
  assert.equal((await f.run()).response.status, 401)
  assert.equal(f.calls.queries, 0)
})

test('authenticated owner query scopes both application identity and submission', async () => {
  const f = fixture()
  const result = await f.run()
  assert.equal(result.response, null)
  assert.equal(result.application.user_id, 'synthetic-applicant')
  assert.deepEqual(f.calls.filters, [
    ['id', 'synthetic-application'], ['user_id', 'synthetic-applicant'],
    ['submitted_at', 'is', null],
  ])
})

test('other owner, draft, missing row and query failure share a closed response', async () => {
  for (const options of [
    { application: { user_id: 'another-applicant', submitted_at: '2026-11-06' } },
    { application: { user_id: 'synthetic-applicant', submitted_at: null } },
    { application: null },
    { queryError: { message: 'unavailable' } },
  ]) {
    const f = fixture(options)
    const { response, application } = await f.run()
    assert.equal(response.status, 404)
    assert.equal(application, null)
    assert.deepEqual(await response.json(), { error: 'Submitted application not found' })
  }
})

test('missing application identifier cannot reach a database query', async () => {
  const f = fixture()
  assert.equal((await f.run('Bearer synthetic-user-jwt', null)).response.status, 400)
  assert.equal(f.calls.queries, 0)
})

test('legacy and modern public API keys still require a verified user JWT', async () => {
  for (const apikey of ['synthetic-legacy-anon-jwt', 'sb_publishable_synthetic']) {
    const f = fixture()
    assert.equal((await f.run('Bearer synthetic-user-jwt', 'synthetic-application', apikey)).response, null)
    const anonymous = fixture()
    assert.equal((await anonymous.run(null, 'synthetic-application', apikey)).response.status, 401)
    assert.equal(anonymous.calls.queries, 0)
  }
})
