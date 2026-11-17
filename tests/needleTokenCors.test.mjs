import test from 'node:test'
import assert from 'node:assert/strict'
import { getCorsHeaders } from '../supabase/functions/_shared/cors.ts'
import { createNeedleTokenHandler } from '../supabase/functions/needle-token/handler.js'

test('real CORS helper rechecks runtime origins after an allowed preflight', async () => {
  const previousDeno = globalThis.Deno
  const previousFetch = globalThis.fetch
  let allowed = 'https://crewme.example'
  let reads = 0
  const env = { SUPABASE_URL: 'https://supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key' }
  globalThis.Deno = { env: { get: key => env[key] } }
  globalThis.fetch = async () => {
    reads++
    return Response.json([{ setting_value: allowed }])
  }
  const handler = createNeedleTokenHandler({ getCorsHeaders,
    createAdminSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'synthetic' } } }) } }),
    needleCallerAccess: async () => ({ role: 'user' }), signNeedleToken: async () => 'synthetic', env: () => '',
  })
  const req = method => new Request('https://supabase.invalid/token', {
    method, headers: { Origin: 'https://crewme.example', Authorization: 'Bearer synthetic' },
  })
  try {
    const first = await handler(req('OPTIONS'))
    assert.equal(first.headers.get('access-control-allow-origin'), allowed)
    assert.equal(first.headers.get('access-control-max-age'), '300')
    allowed = 'https://replacement.example'
    const second = await handler(req('POST'))
    assert.equal(second.headers.get('access-control-allow-origin'), null)
    assert.equal(second.headers.get('access-control-max-age'), null)
    const denied = await handler(req('OPTIONS'))
    assert.equal(denied.headers.get('access-control-allow-origin'), null)
    assert.equal(denied.headers.get('access-control-max-age'), null)
    assert.equal(reads, 3)
  } finally {
    globalThis.fetch = previousFetch
    globalThis.Deno = previousDeno
  }
})
