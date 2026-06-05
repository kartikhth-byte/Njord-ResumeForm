import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient, getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface ProspectInviteRequest {
  prospectId: string
  personalMessage?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizePlainText(value: string, maxLength = 1000) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().slice(0, maxLength)
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  let supabaseClient = createAdminSupabaseClient()
  let authHeader = req.headers.get('Authorization')
  let user: { id: string } | null = null
  let prospectId: string | null = null
  let actorRole: string | null = null
  let inviteReservationAcquired = false

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const authResult = await supabaseClient.auth.getUser(token)
    const authError = authResult.error
    user = authResult.data?.user || null

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { data: canInvite, error: permissionError } = await supabaseClient.rpc('has_permission', {
      user_uuid: user.id,
      permission_name: 'send_prospect_invites',
    })

    if (permissionError || canInvite !== true) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const payload = (await req.json()) as ProspectInviteRequest
    prospectId = payload?.prospectId || null
    const personalMessage = normalizePlainText(payload?.personalMessage || '')

    if (!prospectId) {
      return new Response(JSON.stringify({ error: 'prospectId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { data: actorProfile, error: actorProfileError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    if (actorProfileError) {
      throw actorProfileError
    }

    const { data: roleRows, error: roleError } = await supabaseClient
      .from('user_roles')
      .select(`
        roles (
          name
        )
      `)
      .eq('user_id', user.id)

    if (roleError) {
      throw roleError
    }

    actorRole = (roleRows || []).map((row) => row.roles?.name).filter(Boolean)[0] || null

    const reserveResult = await supabaseClient.rpc('reserve_prospect_invite', {
      p_prospect_id: prospectId,
      p_actor_user_id: user.id,
      p_actor_role_at_event: actorRole,
      p_personal_message: personalMessage || null,
    })

    if (reserveResult.error) {
      throw reserveResult.error
    }

    const reservation = reserveResult.data || {}
    inviteReservationAcquired = true

    if (reservation.invite_state === 'already_sent') {
      return new Response(JSON.stringify({
        success: true,
        alreadySent: true,
        prospectId: reservation.prospect_id,
        message: `Invite already sent by ${reservation.invited_by_recruiter_name} at ${reservation.invited_at}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const runtimeSettings = await getRuntimeSettings([
      'APP_URL',
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'APPLICANT_NOTIFICATION_EMAIL',
    ])

    const appUrl = runtimeSettings.APP_URL?.replace(/\/$/, '')
    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || 'NJORD Ships <onboarding@resend.dev>'
    const overrideInbox = runtimeSettings.APPLICANT_NOTIFICATION_EMAIL?.trim()

    if (!appUrl || !resendApiKey) {
      throw new Error('APP_URL and RESEND_API_KEY must be configured')
    }

    const prospectEmail = reservation.email
    const recipientEmail = overrideInbox || prospectEmail
    const portalUrl = `${appUrl}/applicant/login`
    const portalHost = new URL(portalUrl).host
    const invitedBy = actorProfile?.full_name || actorProfile?.email || actorRole || 'Recruiter'
    const safeName = escapeHtml(reservation.prospect_name || 'there')
    const safeMessage = personalMessage ? escapeHtml(personalMessage).replaceAll('\n', '<br>') : ''

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">NJORD Ships</h1>
              <p style="margin: 6px 0 0 0; color: #dbeafe; font-size: 14px;">Recruiter invitation to the applicant portal</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 24px;">You have been invited to continue your profile</h2>
              <p style="margin: 0 0 14px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Hello ${safeName},
              </p>
              <p style="margin: 0 0 14px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                ${escapeHtml(invitedBy)} has invited you to continue your maritime profile in the NJORD Ships applicant portal.
              </p>
              ${safeMessage ? `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; color: #334155; font-size: 14px;"><strong>Message from your recruiter:</strong></p>
                  <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.6;">${safeMessage}</p>
                </div>
              ` : ''}
              <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 18px 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #1d4ed8; font-size: 14px;"><strong>Portal:</strong> ${portalHost}</p>
                <p style="margin: 0; color: #1d4ed8; font-size: 14px;">Open the portal, sign in with your account, and continue your profile from the applicant dashboard.</p>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${portalUrl}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Open Applicant Portal
                </a>
              </div>
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; word-break: break-all;">
                If the button does not open, copy this URL into your browser:<br>
                <a href="${portalUrl}" style="color: #2563eb; text-decoration: none;">${portalUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [recipientEmail],
        subject: 'Invitation to continue your NJORD Ships profile',
        html,
        tags: {
          category: 'prospect_invite',
          prospect_id: prospectId,
          actor_user_id: user.id,
        },
      }),
    })

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text()
      await supabaseClient.from('audit_log').insert({
        entity_type: 'prospect',
        event_type: 'invite_failed',
        actor_type: 'recruiter',
        actor_user_id: user.id,
        actor_role_at_event: actorRole,
        system_actor: null,
        prospect_id: prospectId,
        payload: {
          invite_state: reservation.invite_state,
          prospect_email: prospectEmail,
          recipient_email: recipientEmail,
          delivery_recipient: recipientEmail,
          override_inbox: overrideInbox || null,
          error: errorBody,
        },
      })
      await supabaseClient.rpc('release_prospect_invite_reservation', {
        p_prospect_id: prospectId,
        p_actor_user_id: user.id,
        p_actor_role_at_event: actorRole,
        p_reason: 'send_failed',
      })
      throw new Error(`Email send failed: ${errorBody}`)
    }

    const result = await emailResponse.json()

    await supabaseClient.from('audit_log').insert({
      entity_type: 'prospect',
      event_type: reservation.invite_state === 'resent' ? 'invite_resent' : 'invite_sent',
      actor_type: 'recruiter',
      actor_user_id: user.id,
      actor_role_at_event: actorRole,
      system_actor: null,
      prospect_id: prospectId,
      payload: {
        invite_state: reservation.invite_state,
        prospect_email: prospectEmail,
        recipient_email: recipientEmail,
        delivery_recipient: recipientEmail,
        override_inbox: overrideInbox || null,
        email_id: result.id,
      },
    })

    return new Response(JSON.stringify({
      success: true,
      inviteState: reservation.invite_state,
      emailId: result.id,
      recipientEmail,
      overrideInbox: overrideInbox || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('send-prospect-invite error:', error)
    if (inviteReservationAcquired && prospectId && user?.id) {
      try {
        await supabaseClient.rpc('release_prospect_invite_reservation', {
          p_prospect_id: prospectId,
          p_actor_user_id: user.id,
          p_actor_role_at_event: actorRole,
          p_reason: error?.message || 'send_failed',
        })
      } catch (releaseError) {
        console.error('Failed to release prospect invite reservation:', releaseError)
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
