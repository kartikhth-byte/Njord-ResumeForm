import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient, getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const MAGIC_LINK_REQUEST_LIMIT = 3
const MIN_RESPONSE_DELAY_MS = 700

interface RequestApplicantMagicLinkPayload {
  email?: string
}

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

async function delayRemaining(startTime: number) {
  const elapsed = Date.now() - startTime
  const remaining = MIN_RESPONSE_DELAY_MS - elapsed
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}

async function sendApplicantMagicLink({
  supabaseClient,
  appUrl,
  resendApiKey,
  emailFrom,
  applicantNotificationEmail,
  prospect,
  recipientEmail,
  requestId,
}: {
  supabaseClient: ReturnType<typeof createAdminSupabaseClient>
  appUrl: string
  resendApiKey: string
  emailFrom: string
  applicantNotificationEmail: string
  prospect: Record<string, unknown>
  recipientEmail: string
  requestId: string
}) {
  const redirectTo = `${appUrl.replace(/\/$/, '')}/auth/callback?login_intent=applicant`
  const prospectName = typeof prospect.name === 'string' && prospect.name.trim()
    ? prospect.name.trim()
    : recipientEmail
  const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
    type: 'magiclink',
    email: recipientEmail,
    options: {
      redirectTo,
    },
  })

  if (linkError) {
    throw new Error(linkError.message)
  }

  const actionLink =
    linkData?.properties?.action_link ||
    linkData?.action_link ||
    `${redirectTo}?email=${encodeURIComponent(recipientEmail)}`

  const deliveryAddress = applicantNotificationEmail || recipientEmail
  const deliveryNote =
    applicantNotificationEmail && applicantNotificationEmail !== recipientEmail
      ? `<p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
          Development override active. This access link was generated for <strong>${recipientEmail}</strong> and routed to the configured applicant notification inbox instead of the candidate mailbox.
        </p>`
      : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 24px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); padding: 32px;">
              <p style="margin: 0; color: #bfdbfe; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;">Njordships Applicant Access</p>
              <h1 style="margin: 10px 0 0 0; color: #ffffff; font-size: 28px;">Your sign-in link is ready</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px; line-height: 1.7;">
                Hi ${prospectName}, we received a request to sign in for <strong>${recipientEmail}</strong>.
              </p>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                If this email belongs to an approved prospect, use the secure link below to continue to the applicant portal.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${actionLink}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 14px 24px; border-radius: 10px;">
                  Continue to applicant portal
                </a>
              </div>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px 0; color: #1d4ed8; font-size: 14px; line-height: 1.6; word-break: break-all;">
                ${actionLink}
              </p>
              ${deliveryNote}
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                This link is private and should only be used by the intended candidate.
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
      to: [deliveryAddress],
      subject: 'Njordships applicant access link',
      html,
    }),
  })

  if (!emailResponse.ok) {
    const error = await emailResponse.json().catch(() => ({}))
    throw new Error(`Applicant access email send failed: ${JSON.stringify(error)}`)
  }

  await emailResponse.json().catch(() => null)

  await supabaseClient
    .from('applicant_magic_link_requests')
    .update({
      request_status: 'sent',
      sent_to_email: deliveryAddress,
      sent_at: new Date().toISOString(),
    })
    .eq('id', requestId)
}

serve(async (req) => {
  const startedAt = Date.now()
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseClient = createAdminSupabaseClient()
    const runtimeSettings = await getRuntimeSettings([
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'APP_URL',
      'APPLICANT_NOTIFICATION_EMAIL',
    ], supabaseClient)

    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || 'NJORD Ships <onboarding@resend.dev>'
    const appUrl = runtimeSettings.APP_URL || Deno.env.get('APP_URL') || Deno.env.get('VITE_APP_URL') || 'http://localhost:3000'
    const applicantNotificationEmail = runtimeSettings.APPLICANT_NOTIFICATION_EMAIL || ''

    const body = await req.json().catch(() => ({}))
    const email = typeof (body as RequestApplicantMagicLinkPayload)?.email === 'string'
      ? (body as RequestApplicantMagicLinkPayload).email.trim()
      : ''

    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail) {
      await delayRemaining(startedAt)
      return json({
        success: true,
        message: 'If the email is eligible, a sign-in link will be sent shortly.',
      }, corsHeaders)
    }

    const hourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentRequestCount } = await supabaseClient
      .from('applicant_magic_link_requests')
      .select('id', { count: 'exact', head: true })
      .eq('email_normalized', normalizedEmail)
      .gte('created_at', hourAgoIso)

    if ((recentRequestCount ?? 0) >= MAGIC_LINK_REQUEST_LIMIT) {
      const { data: matchingProspect } = await supabaseClient
        .from('prospects')
        .select('id, name, email, status, archived_at, deleted_at, bounce_flag')
        .eq('email_normalized', normalizedEmail)
        .eq('status', 'approved')
        .is('archived_at', null)
        .is('deleted_at', null)
        .eq('bounce_flag', false)
        .maybeSingle()

      const { data: requestRow, error: requestError } = await supabaseClient
        .from('applicant_magic_link_requests')
        .insert({
          prospect_id: matchingProspect?.id ?? null,
          email,
          email_normalized: normalizedEmail,
          request_status: 'rate_limited',
        })
        .select('id')
        .single()

      if (requestError) {
        throw requestError
      }

      if (matchingProspect?.id) {
        await supabaseClient.rpc('write_audit_event', {
          p_entity_type: 'prospect',
          p_event_type: 'prospect.magic_link_locked_out',
          p_actor_type: 'system',
          p_system_actor: 'request-applicant-magic-link',
          p_correlation_id: requestRow?.id ?? null,
          p_prospect_id: matchingProspect.id,
          p_payload: {
            email_normalized: normalizedEmail,
            request_count: recentRequestCount,
          },
        })
      }

      await delayRemaining(startedAt)
      return json({
        success: true,
        message: 'If the email is eligible, a sign-in link will be sent shortly.',
      }, corsHeaders)
    }

    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects')
      .select('id, name, email, status, archived_at, deleted_at, bounce_flag')
      .eq('email_normalized', normalizedEmail)
      .eq('status', 'approved')
      .is('archived_at', null)
      .is('deleted_at', null)
      .eq('bounce_flag', false)
      .maybeSingle()

    if (prospectError) {
      throw prospectError
    }

    const { data: requestRow, error: requestError } = await supabaseClient
      .from('applicant_magic_link_requests')
      .insert({
        prospect_id: prospect?.id ?? null,
        email,
        email_normalized: normalizedEmail,
        request_status: prospect ? 'attempted' : 'suppressed',
      })
      .select('id')
      .single()

    if (requestError) {
      throw requestError
    }

    if (prospect) {
      await sendApplicantMagicLink({
        supabaseClient,
        appUrl,
        resendApiKey,
        emailFrom,
        applicantNotificationEmail,
        prospect,
        recipientEmail: prospect.email,
        requestId: requestRow.id,
      })
    }

    await delayRemaining(startedAt)

    return json({
      success: true,
      message: 'If the email is eligible, a sign-in link will be sent shortly.',
    }, corsHeaders)
  } catch (error) {
    console.error('request-applicant-magic-link error:', error)
    await delayRemaining(startedAt)
    return json({
      error: error?.message || 'An unexpected error occurred',
    }, corsHeaders, 500)
  }
})
