import { DEFAULT_NEEDLE_ORG_ID } from '../_shared/needle-access.js'

// Dependencies are injected so the deployed handler can be exercised offline.
// Nothing here caches identity, permissions, tokens or allowed origins.
export function createNeedleTokenHandler({ getCorsHeaders, createAdminSupabaseClient,
  needleCallerAccess, signNeedleToken, env, now = () => performance.now(), logError = console.error }) {
  return async function handle(req) {
    const started = now()
    const timings = []
    async function measure(name, operation) {
      const start = now()
      try { return await operation() } finally {
        timings.push(`${name};dur=${Math.max(0, now() - start).toFixed(1)}`)
      }
    }
    let corsHeaders = {}
    const corsPromise = measure('cors', () => getCorsHeaders(req, {
      allowMethods: 'POST, OPTIONS', exposeHeaders: 'Server-Timing',
    }))
    function response(body, status = 200) {
      return new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
          'Server-Timing': [...timings, `total;dur=${Math.max(0, now() - started).toFixed(1)}`].join(', ') },
      })
    }
    try {
      if (req.method !== 'POST') {
        corsHeaders = await corsPromise
        if (req.method === 'OPTIONS') {
          // Cache only the browser's preflight permission. Actual POSTs still
          // resolve the current origin, identity and role on every request.
          if (corsHeaders['Access-Control-Allow-Origin']) {
            corsHeaders = { ...corsHeaders, 'Access-Control-Max-Age': '300' }
          }
          return response(null, 204)
        }
        return response({ error: 'Method not allowed' }, 405)
      }
      const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '')
      if (!token) {
        corsHeaders = await corsPromise
        return response({ error: 'Missing authorization header' }, 401)
      }
      const admin = createAdminSupabaseClient()
      // Independent reads overlap; all authorization gates still precede signing.
      const [cors, auth] = await Promise.all([
        corsPromise, measure('auth', () => admin.auth.getUser(token)),
      ])
      corsHeaders = cors
      const { data: { user }, error: authError } = auth
      if (authError || !user) return response({ error: 'Invalid token' }, 401)

      const access = await measure('access', () => needleCallerAccess(admin, user.id, env('NEEDLE_AI_SEARCH_ACCESS')))
      const profile = access.profile
      const needleRole = access.role
      if (!needleRole) return response({ error: 'AI search is not available for this account' }, 403)
      if (needleRole === 'admin') {
        const { error: auditError } = await measure('audit', () => admin.from('platform_operation_events').insert({
          category: 'support', action: 'needle_admin_session', actor_id: user.id, status: 'succeeded',
          details: { organization_id: env('NEEDLE_ORG_ID') || DEFAULT_NEEDLE_ORG_ID },
        }))
        if (auditError) return response({ error: 'Administrative access audit is unavailable' }, 503)
      }
      const signed = await measure('sign', () => signNeedleToken(user.id, {
        email: profile?.email || user.email || '', name: profile?.full_name || '',
        org: env('NEEDLE_ORG_ID') || DEFAULT_NEEDLE_ORG_ID, role: needleRole,
      }))
      return response({ token: signed, expiresIn: 120 })
    } catch (error) {
      // Wait for CORS even if the independent auth operation failed first.
      corsHeaders = await corsPromise.catch(() => ({}))
      logError('needle-token failed:', error instanceof Error ? error.message : 'unknown error')
      return response({ error: 'AI search sign-in failed' }, 500)
    }
  }
}
