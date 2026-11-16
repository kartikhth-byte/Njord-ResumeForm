import test from 'node:test'
import assert from 'node:assert/strict'
import { createNeedleConnection } from '../src/lib/needleConnection.js'

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
test('concurrent mounts coalesce only the same identity, and later visits re-authorize', async () => {
  const gate = deferred(); let calls = 0
  const connection = createNeedleConnection({ exchange: async () => { calls++; await gate.promise; return { ok: true } }, logout: async () => {} })
  const first = connection.start('alice:Recruiter')
  assert.equal(connection.start('alice:Recruiter'), first)
  const other = connection.start('bob:Recruiter')
  assert.notEqual(other, first)
  await Promise.resolve(); assert.equal(calls, 1)
  gate.resolve(); await Promise.all([first, other]); assert.equal(calls, 2)
  await connection.start('alice:Recruiter'); assert.equal(calls, 3)
})
test('logout follows an in-flight cookie exchange and precedes the next identity', async () => {
  const gate = deferred(), events = []
  const connection = createNeedleConnection({ exchange: async () => { events.push('exchange'); await gate.promise; events.push('cookie'); return { ok: true } }, logout: async () => { events.push('logout') } })
  const first = connection.start('alice')
  await Promise.resolve()
  const logout = connection.end(), second = connection.start('bob')
  gate.resolve(); await Promise.all([first, logout, second])
  assert.deepEqual(events, ['exchange', 'cookie', 'logout', 'exchange', 'cookie'])
})
test('failure does not poison retries and missing identity makes no request', async () => {
  let calls = 0
  const connection = createNeedleConnection({ exchange: async () => { if (++calls === 1) throw new Error('offline'); return { ok: true } }, logout: async () => {} })
  assert.deepEqual(await connection.start(''), { ok: false, reason: 'identity' })
  await assert.rejects(connection.start('alice'), /offline/)
  assert.deepEqual(await connection.start('alice'), { ok: true })
  assert.equal(calls, 2)
})
