// needle-token: a short-lived Ed25519 token that signs the current Holmes
// user in to Needle (AI search). Holmes posts it once to /ai/auth/holmes.
// Design: docs/needle-in-holmes-design.md section 4.2.
//
// Secrets:
//   NEEDLE_TOKEN_PRIVATE_KEY  Ed25519 private key, PKCS#8 PEM (\n escapes allowed)
//   NEEDLE_AI_SEARCH_ACCESS   off (default) | operator | on
//   NEEDLE_ORG_ID             optional; defaults to the seeded organization id
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { DEFAULT_NEEDLE_ORG_ID, needleRoleFor } from '../_shared/needle-access.js'

const TOKEN_LIFETIME_SECONDS = 120

function json(body: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

let cachedKey: CryptoKey | null = null

async function signingKey(): Promise<CryptoKey | null> {
  if (cachedKey) return cachedKey
  const pem = (Deno.env.get('NEEDLE_TOKEN_PRIVATE_KEY') || '').replace(/\\n/g, '\n').trim()
  if (!pem) return null
  cachedKey = await importPKCS8(pem, 'EdDSA')
  return cachedKey
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

    const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }, { data: operatorRow, error: operatorError }] = await Promise.all([
      admin.from('profiles').select('full_name, email, user_type').eq('id', user.id).maybeSingle(),
      admin.from('user_roles').select('roles ( name )').eq('user_id', user.id),
      admin.from('platform_operators').select('user_id').eq('user_id', user.id).maybeSingle(),
    ])

    if (profileError || rolesError || operatorError) {
      return json({ error: 'AI search authorization is unavailable' }, corsHeaders, 503)
    }

    const roleNames = (roleRows || [])
      .map((row: { roles?: { name?: string } | null }) => row.roles?.name)
      .filter(Boolean) as string[]

    const needleRole = needleRoleFor({
      access: Deno.env.get('NEEDLE_AI_SEARCH_ACCESS'),
      isOperator: Boolean(operatorRow),
      roleNames,
      userType: profile?.user_type,
    })
    if (!needleRole) return json({ error: 'AI search is not available for this account' }, corsHeaders, 403)

    const key = await signingKey()
    if (!key) return json({ error: 'AI search is not configured' }, corsHeaders, 503)

    const now = Math.floor(Date.now() / 1000)
    const signed = await new SignJWT({
      email: profile?.email || user.email || '',
      name: profile?.full_name || '',
      org: Deno.env.get('NEEDLE_ORG_ID') || DEFAULT_NEEDLE_ORG_ID,
      role: needleRole,
    })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setIssuer('holmes')
      .setAudience('needle')
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_LIFETIME_SECONDS)
      .setJti(crypto.randomUUID())
      .sign(key)

    return json({ token: signed, expiresIn: TOKEN_LIFETIME_SECONDS }, corsHeaders)
  } catch (error) {
    console.error('needle-token failed:', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'AI search sign-in failed' }, corsHeaders, 500)
  }
})
