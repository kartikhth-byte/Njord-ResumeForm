// needle-token: a short-lived Ed25519 token that signs the current Holmes
// user in to Needle (AI search). Holmes posts it once to /ai/auth/holmes.
// Design: docs/needle-in-holmes-design.md section 4.2.
//
// Secrets:
//   NEEDLE_TOKEN_PRIVATE_KEY  Ed25519 private key, PKCS#8 PEM (\n escapes allowed)
//   NEEDLE_AI_SEARCH_ACCESS   off (default) | operator | on
//   NEEDLE_ORG_ID             optional; defaults to the seeded organization id
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { signNeedleToken } from '../_shared/needle-signing.ts'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { DEFAULT_NEEDLE_ORG_ID, needleCallerAccess } from '../_shared/needle-access.js'

const TOKEN_LIFETIME_SECONDS = 120

function json(body: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, corsHeaders, 405)
  }

  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '')
    if (!token) return json({ error: 'Missing authorization header' }, corsHeaders, 401)

    const admin = createAdminSupabaseClient()
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'Invalid token' }, corsHeaders, 401)

    const access = await needleCallerAccess(admin, user.id, Deno.env.get('NEEDLE_AI_SEARCH_ACCESS'))
    const profile = access.profile
    const needleRole = access.role
    if (!needleRole) return json({ error: 'AI search is not available for this account' }, corsHeaders, 403)

    if (needleRole === 'admin') {
      const { error: auditError } = await admin.from('platform_operation_events').insert({
        category: 'support', action: 'needle_admin_session', actor_id: user.id, status: 'succeeded',
        details: { organization_id: Deno.env.get('NEEDLE_ORG_ID') || DEFAULT_NEEDLE_ORG_ID },
      })
      if (auditError) return json({ error: 'Administrative access audit is unavailable' }, corsHeaders, 503)
    }

    const signed = await signNeedleToken(user.id, {
      email: profile?.email || user.email || '',
      name: profile?.full_name || '',
      org: Deno.env.get('NEEDLE_ORG_ID') || DEFAULT_NEEDLE_ORG_ID,
      role: needleRole,
    })

    return json({ token: signed, expiresIn: TOKEN_LIFETIME_SECONDS }, corsHeaders)
  } catch (error) {
    console.error('needle-token failed:', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'AI search sign-in failed' }, corsHeaders, 500)
  }
})
