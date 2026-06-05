import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

function json(payload: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseClient = createAdminSupabaseClient()
    const body = await req.json().catch(() => ({}))
    const applicantSessionJwt = typeof body?.applicantSessionJwt === 'string' ? body.applicantSessionJwt.trim() : ''

    if (!applicantSessionJwt) {
      return json({ error: 'applicantSessionJwt is required' }, corsHeaders, 400)
    }

    const { error } = await supabaseClient.auth.admin.signOut(applicantSessionJwt, 'global')

    if (error) {
      throw error
    }

    return json({
      success: true,
      session_revoked: true,
    }, corsHeaders)
  } catch (error) {
    console.error('revoke-applicant-sessions error:', error)
    return json({
      error: error?.message || 'An unexpected error occurred',
    }, corsHeaders, 500)
  }
})
