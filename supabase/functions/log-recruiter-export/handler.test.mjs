import assert from 'node:assert/strict'
import test from 'node:test'
import { createExportLogHandler } from './handler.ts'

function fixture({ user = { id: 'synthetic-user' }, authError = null, allowed = true,
  permissionError = null, roleError = null, insertError = null } = {}) {
  const writes = []
  const permissions = []
  let authCalls = 0
  const admin = {
    auth: { getUser: async token => {
      authCalls += 1
      assert.equal(token, 'synthetic-user-jwt')
      return { data: { user }, error: authError }
    } },
    rpc: async (name, args) => {
      assert.equal(name, 'has_permission')
      assert.equal(args.user_uuid, 'synthetic-user')
      permissions.push(args.permission_name)
      return { data: allowed, error: permissionError }
    },
    from: table => table === 'user_roles' ? {
      select() { return this },
      eq: async (column, id) => {
        assert.equal(column, 'user_id')
        assert.equal(id, 'synthetic-user')
        return { data: [{ roles: { name: 'Master Recruiter' } }], error: roleError }
      },
    } : {
      insert: async row => {
        assert.equal(table, 'audit_log')
        if (!insertError) writes.push(row)
        return { error: insertError }
      },
    },
  }
  const handler = createExportLogHandler({ createAdminSupabaseClient: () => admin,
    getCorsHeaders: async () => ({ 'Access-Control-Allow-Origin': 'https://synthetic.invalid' }) })
  const request = (authorization = 'Bearer synthetic-user-jwt', method = 'POST', format = 'csv') =>
    new Request('https://synthetic.invalid/log-recruiter-export', {
      method, headers: authorization ? { Authorization: authorization, 'Content-Type': 'application/json' } : {},
      ...(['GET', 'OPTIONS'].includes(method) ? {} : { body: JSON.stringify({
        report_type: 'kpi_summary', export_format: format, row_count: 2, row_ids_hash: 'a'.repeat(64),
      }) }),
    })
  return { handler, request, writes, permissions, authCalls: () => authCalls }
}

test('missing/malformed bearer is denied before any authentication or write', async () => {
  for (const header of [null, 'sb_secret_not_a_user_session', 'Bearer ', 'Basic synthetic']) {
    const f = fixture()
    assert.equal((await f.handler(f.request(header))).status, 401)
    assert.equal(f.authCalls(), 0)
    assert.equal(f.writes.length, 0)
  }
})

test('invalid user JWT is denied before permission lookup or write', async () => {
  const f = fixture({ user: null, authError: { message: 'invalid JWT' } })
  assert.equal((await f.handler(f.request())).status, 401)
  assert.deepEqual(f.permissions, [])
  assert.equal(f.writes.length, 0)
})

test('denied or unavailable export permissions fail closed', async () => {
  for (const options of [{ allowed: false }, { allowed: true, permissionError: { message: 'unavailable' } }]) {
    const f = fixture(options)
    assert.equal((await f.handler(f.request())).status, 403)
    assert.equal(f.writes.length, 0)
  }
})

for (const format of ['csv', 'pdf']) {
  test(`verified ${format} export checks permissions and records only verified actor`, async () => {
    const f = fixture()
    const response = await f.handler(f.request('Bearer synthetic-user-jwt', 'POST', format))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true })
    assert.deepEqual(f.permissions, ['export_data', `export_${format}`])
    assert.equal(f.writes.length, 1)
    assert.equal(f.writes[0].actor_user_id, 'synthetic-user')
    assert.equal(f.writes[0].payload.row_count, 2)
    assert.equal(f.writes[0].event_type, `export.${format}_exported`)
  })
}

test('unsupported method and preflight never authenticate or write', async () => {
  const f = fixture()
  assert.equal((await f.handler(f.request(null, 'GET'))).status, 405)
  assert.equal((await f.handler(f.request(null, 'OPTIONS'))).status, 204)
  assert.equal(f.authCalls(), 0)
  assert.equal(f.writes.length, 0)
})
