import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { signNeedleToken } from '../_shared/needle-signing.ts'
import { DEFAULT_NEEDLE_ORG_ID, needleCallerAccess } from '../_shared/needle-access.js'
import { integrationHandler } from './handler.js'
serve(async req => {
  const cors = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    const admin = createAdminSupabaseClient()
    const requester = (token: string) => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const authorize = (id: string) => needleCallerAccess(admin, id, Deno.env.get('NEEDLE_AI_SEARCH_ACCESS'))
    const result = await integrationHandler({ admin, requester, authorize, sign: signNeedleToken,
      origin: Deno.env.get('NEEDLE_API_ORIGIN'), organization: Deno.env.get('NEEDLE_ORG_ID') || DEFAULT_NEEDLE_ORG_ID })(req)
    const headers = new Headers(result.headers);Object.entries(cors).forEach(([k,v]) => headers.set(k,v))
    return new Response(result.body, { status: result.status, headers })
  } catch {
    return new Response(JSON.stringify({ error: 'Needle integration unavailable. No candidate was saved.' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  }
})
