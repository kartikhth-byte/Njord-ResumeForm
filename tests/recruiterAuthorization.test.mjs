import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRecruiterAuthorization } from '../src/lib/recruiterAuthorization.js'

function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
function fixture({ roles, permissions, operator }) {
  const calls = []
  return {
    calls,
    from(table) {
      return { select() { return {
        eq(key, id) { calls.push({ table, key, id }); return roles },
        in(key, ids) { calls.push({ table, key, ids }); return permissions },
      } } }
    },
    rpc(name) { calls.push({ table: name }); return operator },
  }
}

test('operator read overlaps role lookup; permissions wait for current role IDs', async () => {
  const roles = deferred(), operator = deferred()
  const client = fixture({ roles: roles.promise, operator: operator.promise,
    permissions: { data: [{ permissions: { name: 'read' } }, { permissions: { name: 'read' } }] } })
  const pending = loadRecruiterAuthorization(client, 'actor')
  assert.deepEqual(client.calls.map(x => x.table), ['user_roles', 'is_platform_operator'])
  roles.resolve({ data: [{ role_id: 'fresh-role', roles: { name: 'Coordinator' } }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(client.calls[2], { table: 'role_permissions', key: 'role_id', ids: ['fresh-role'] })
  operator.resolve({ data: false })
  const result = await pending
  assert.deepEqual(result.permissionNames, ['read'])
  assert.equal(result.roleRows[0].roles.name, 'Coordinator')
  assert.equal(result.operatorFlag, false)
})

test('no assigned role skips permissions and returns no role authority', async () => {
  const client = fixture({ roles: { data: [] }, operator: { data: false } })
  const result = await loadRecruiterAuthorization(client, 'actor')
  assert.deepEqual(result.permissionNames, [])
  assert.deepEqual(result.roleRows, [])
  assert.equal(client.calls.some(x => x.table === 'role_permissions'), false)
})

for (const failing of ['roles', 'permissions']) {
  test(`${failing} failure is returned safely even when caller abandons profile loading`, async () => {
    const error = new Error('Synthetic failure')
    const client = fixture({
      roles: failing === 'roles' ? Promise.reject(error) : { data: [{ role_id: 'role' }] },
      permissions: failing === 'permissions' ? { error } : { data: [] },
      operator: { data: false },
    })
    assert.equal((await loadRecruiterAuthorization(client, 'actor')).error, error)
  })
}

test('live operator false overrides cached true; transient error retains existing fallback', async () => {
  const client = fixture({ roles: { data: [] }, operator: { data: false } })
  assert.equal((await loadRecruiterAuthorization(client, 'actor', true)).operatorFlag, false)
  client.rpc = async () => { throw new Error('Synthetic unavailable') }
  assert.equal((await loadRecruiterAuthorization(client, 'actor', true)).operatorFlag, true)
  assert.equal((await loadRecruiterAuthorization(client, 'actor')).operatorFlag, false)
})
