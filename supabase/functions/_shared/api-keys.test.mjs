import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import {
  createAdminFetch,
  getAdminApiKey,
  getPublicApiKey,
  isValidPublicApiKey,
} from './api-keys.ts'

const values = new Map()
const originalDeno = globalThis.Deno
const originalFetch = globalThis.fetch

beforeEach(() => {
  values.clear()
  globalThis.Deno = { env: { get: (name) => values.get(name) } }
})

afterEach(() => {
  globalThis.Deno = originalDeno
  globalThis.fetch = originalFetch
})

test('new named keys take precedence over legacy keys', () => {
  values.set('SUPABASE_PUBLISHABLE_KEYS', JSON.stringify({ default: 'sb_publishable_test' }))
  values.set('SUPABASE_SECRET_KEYS', JSON.stringify({ default: 'sb_secret_test' }))
  values.set('SUPABASE_ANON_KEY', 'legacy-anon')
  values.set('SUPABASE_SERVICE_ROLE_KEY', 'legacy-service')

  assert.equal(getPublicApiKey(), 'sb_publishable_test')
  assert.equal(getAdminApiKey(), 'sb_secret_test')
  assert.equal(isValidPublicApiKey('sb_publishable_test'), true)
  assert.equal(isValidPublicApiKey('legacy-anon'), true)
  assert.equal(isValidPublicApiKey('sb_secret_test'), false)
})

test('legacy keys remain available until the deployment is migrated', () => {
  values.set('SUPABASE_ANON_KEY', 'legacy-anon')
  values.set('SUPABASE_SERVICE_ROLE_KEY', 'legacy-service')

  assert.equal(getPublicApiKey(), 'legacy-anon')
  assert.equal(getAdminApiKey(), 'legacy-service')
})

test('modern admin fetch sends secret only as apikey and preserves user JWT', async () => {
  const seen = []
  globalThis.fetch = async (_url, init) => {
    seen.push(new Headers(init.headers))
    return new Response(null, { status: 204 })
  }
  const adminFetch = createAdminFetch('sb_secret_test')

  await adminFetch('https://example.test/rest/v1/items', {
    headers: { Authorization: 'Bearer sb_secret_test' },
  })
  await adminFetch('https://example.test/auth/v1/user', {
    headers: { Authorization: 'Bearer user-jwt' },
  })

  assert.equal(seen[0].get('apikey'), 'sb_secret_test')
  assert.equal(seen[0].get('authorization'), null)
  assert.equal(seen[1].get('apikey'), 'sb_secret_test')
  assert.equal(seen[1].get('authorization'), 'Bearer user-jwt')
})
