import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function json(payload: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function getCallerRoleName(supabaseClient: ReturnType<typeof createAdminSupabaseClient>, userId: string) {
  const { data, error } = await supabaseClient
    .from('user_roles')
    .select(`
      roles (
        name
      )
    `)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return data?.[0]?.roles?.name || null
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseClient = createAdminSupabaseClient()
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, corsHeaders, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !caller) {
      return json({ error: 'Invalid token' }, corsHeaders, 401)
    }

    const { data: canEditProspects, error: permError } = await supabaseClient.rpc('has_permission', {
      user_uuid: caller.id,
      permission_name: 'edit_prospects',
    })

    if (permError || canEditProspects !== true) {
      return json({ error: 'Insufficient permissions' }, corsHeaders, 403)
    }

    const body = await req.json()
    const prospectId = typeof body?.prospectId === 'string' ? body.prospectId : ''
    const nextEmail = typeof body?.email === 'string' ? body.email.trim() : ''
    const applicantSessionJwt = typeof body?.applicantSessionJwt === 'string' ? body.applicantSessionJwt.trim() : ''

    if (!prospectId) {
      return json({ error: 'prospectId is required' }, corsHeaders, 400)
    }

    const normalizedNextEmail = normalizeEmail(nextEmail)
    if (!normalizedNextEmail) {
      return json({ error: 'email is required' }, corsHeaders, 400)
    }

    const callerRoleName = await getCallerRoleName(supabaseClient, caller.id)
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('id, name, email, email_normalized, claimed_at, applicant_user_id, bounce_flag')
      .eq('id', prospectId)
      .maybeSingle()

    if (prospectError) {
      throw prospectError
    }

    if (!prospect) {
      return json({ error: 'Prospect not found' }, corsHeaders, 404)
    }

    if (!prospect.claimed_at || !prospect.applicant_user_id) {
      return json({ error: 'Prospect must be claimed before it can be rebound' }, corsHeaders, 400)
    }

    if (prospect.email_normalized === normalizedNextEmail) {
      return json({
        success: true,
        prospect_id: prospect.id,
        email: prospect.email,
        email_normalized: prospect.email_normalized,
        session_revoked: false,
        no_op: true,
      }, corsHeaders)
    }

    const { data: duplicateProspect, error: duplicateError } = await supabaseClient
      .from('prospects')
      .select('id')
      .eq('email_normalized', normalizedNextEmail)
      .is('archived_at', null)
      .is('deleted_at', null)
      .neq('id', prospect.id)
      .maybeSingle()

    if (duplicateError) {
      throw duplicateError
    }

    if (duplicateProspect) {
      return json({ error: 'email already exists' }, corsHeaders, 409)
    }

    const oldEmail = prospect.email
    const oldEmailNormalized = prospect.email_normalized
    let sessionRevoked = false

    const { error: authUpdateError } = await supabaseClient.auth.admin.updateUserById(
      prospect.applicant_user_id,
      {
        email: nextEmail,
        email_confirm: true,
      }
    )

    if (authUpdateError) {
      throw authUpdateError
    }

    try {
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({
          email: nextEmail,
          user_type: 'applicant',
        })
        .eq('id', prospect.applicant_user_id)

      if (profileError) {
        throw profileError
      }

      const { error: prospectUpdateError } = await supabaseClient
        .from('prospects')
        .update({
          email: nextEmail,
          bounce_flag: false,
        })
        .eq('id', prospect.id)

      if (prospectUpdateError) {
        throw prospectUpdateError
      }

      const { error: requestInvalidationError } = await supabaseClient
        .from('applicant_magic_link_requests')
        .update({
          request_status: 'invalidated',
          invalidated_at: new Date().toISOString(),
          invalidation_reason: 'postclaim_rebind',
        })
        .eq('email_normalized', oldEmailNormalized)
        .is('invalidated_at', null)

      if (requestInvalidationError) {
        throw requestInvalidationError
      }

      if (applicantSessionJwt) {
        const { error: signOutError } = await supabaseClient.auth.admin.signOut(applicantSessionJwt, 'global')
        if (signOutError) {
          throw signOutError
        }
        sessionRevoked = true
      }

      await supabaseClient.rpc('write_audit_event', {
        p_entity_type: 'prospect',
        p_event_type: 'prospect.email_changed',
        p_actor_type: 'recruiter',
        p_actor_user_id: caller.id,
        p_actor_role_at_event: callerRoleName,
        p_system_actor: 'rebind-prospect-email-postclaim',
        p_prospect_id: prospect.id,
        p_payload: {
          old_email: oldEmail,
          old_email_normalized: oldEmailNormalized,
          new_email: nextEmail,
          new_email_normalized: normalizedNextEmail,
          session_revoked: sessionRevoked,
        },
      })

      return json({
        success: true,
        prospect_id: prospect.id,
        email: nextEmail,
        email_normalized: normalizedNextEmail,
        session_revoked: sessionRevoked,
        caller_role: callerRoleName,
      }, corsHeaders)
    } catch (operationError) {
      try {
        await supabaseClient.auth.admin.updateUserById(prospect.applicant_user_id, {
          email: oldEmail,
          email_confirm: true,
        })

        await supabaseClient
          .from('profiles')
          .update({
            email: oldEmail,
            user_type: 'applicant',
          })
          .eq('id', prospect.applicant_user_id)

        await supabaseClient
          .from('prospects')
          .update({
            email: oldEmail,
            bounce_flag: prospect.bounce_flag,
          })
          .eq('id', prospect.id)
      } catch (_rollbackError) {
        // Best-effort rollback. The caller already saw the failure, and the
        // original email is restored where Supabase Admin and DB access allow it.
      }

      throw operationError
    }
  } catch (error) {
    console.error('rebind-prospect-email-postclaim error:', error)
    return json({
      error: error?.message || 'An unexpected error occurred',
    }, corsHeaders, 500)
  }
})
