import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient, getRuntimeSettings } from '../_shared/runtime-settings.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REVIEW_LINK_TTL_HOURS = 24 * 7

interface RecruiterNotificationRequest {
  applicationId: string
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value)
  return toHex(await crypto.subtle.digest('SHA-256', encoded))
}

function generateReviewAccessToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { applicationId }: RecruiterNotificationRequest = await req.json()

    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'applicationId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const runtimeSettings = await getRuntimeSettings([
      'APP_URL',
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'RECRUITER_NOTIFICATION_EMAIL',
    ])
    const appUrl = runtimeSettings.APP_URL?.replace(/\/$/, '')
    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || 'NJORD Ships <onboarding@resend.dev>'
    const recruiterNotificationEmail = runtimeSettings.RECRUITER_NOTIFICATION_EMAIL?.trim()
    const supabaseClient = createAdminSupabaseClient()

    if (!appUrl || !resendApiKey) {
      throw new Error('APP_URL and RESEND_API_KEY must be configured')
    }

    const { data: application, error: applicationError } = await supabaseClient
      .from('applications')
      .select('id, public_token, reference_number, applied_rank, submitted_at')
      .eq('id', applicationId)
      .not('submitted_at', 'is', null)
      .single()

    if (applicationError || !application) {
      throw new Error('Submitted application not found')
    }

    if (!application.public_token) {
      throw new Error('Application is missing public_token')
    }

    const { data: applicationDataRow, error: applicationDataError } = await supabaseClient
      .from('application_data')
      .select('data')
      .eq('application_id', applicationId)
      .single()

    if (applicationDataError || !applicationDataRow) {
      throw new Error('Application data not found')
    }

    const section1 = applicationDataRow.data?.section1 || {}
    const section2 = applicationDataRow.data?.section2 || {}
    const applicantName = [section2.firstName, section2.middleName, section2.surname]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Unnamed Applicant'
    const position = section1.appliedForRank || application.applied_rank || 'Maritime Position'

    const reviewAccessToken = generateReviewAccessToken()
    const reviewAccessTokenHash = await sha256(reviewAccessToken)
    const reviewAccessTokenExpiresAt = new Date(Date.now() + REVIEW_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString()

    const { error: tokenUpdateError } = await supabaseClient
      .from('applications')
      .update({
        review_access_token_hash: reviewAccessTokenHash,
        review_access_token_expires_at: reviewAccessTokenExpiresAt,
      })
      .eq('id', applicationId)

    if (tokenUpdateError) {
      throw new Error(`Failed to store review access token: ${tokenUpdateError.message}`)
    }

    const { data: recruiters, error: recruiterError } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('user_type', 'recruiter')
      .not('email', 'is', null)

    if (recruiterError) {
      throw new Error(`Failed to load recruiter recipients: ${recruiterError.message}`)
    }

    const recipientEmails = recruiterNotificationEmail
      ? [recruiterNotificationEmail]
      : Array.from(
          new Set((recruiters || []).map((recruiter) => recruiter.email).filter(Boolean))
        )

    if (recipientEmails.length === 0) {
      throw new Error('No recruiter recipients configured')
    }

    const reviewLink = `${appUrl}/application/view/${application.public_token}?access=${reviewAccessToken}`
    const safeApplicantName = escapeHtml(applicantName)
    const safePosition = escapeHtml(position)
    const safeReferenceNumber = escapeHtml(application.reference_number || 'Pending Reference')
    const safeSubmittedAt = escapeHtml(
      application.submitted_at
        ? new Date(application.submitted_at).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'Unknown'
    )

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
              <p style="margin: 6px 0 0 0; color: #dbeafe; font-size: 14px;">Submitted Application Ready For Review</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 24px;">New submitted application</h2>
              <p style="margin: 0 0 14px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                A candidate has submitted an application and it is ready for recruiter review.
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #334155; font-size: 14px;"><strong>Applicant:</strong> ${safeApplicantName}</p>
                <p style="margin: 0 0 8px 0; color: #334155; font-size: 14px;"><strong>Position:</strong> ${safePosition}</p>
                <p style="margin: 0 0 8px 0; color: #334155; font-size: 14px;"><strong>Reference:</strong> ${safeReferenceNumber}</p>
                <p style="margin: 0; color: #334155; font-size: 14px;"><strong>Submitted:</strong> ${safeSubmittedAt}</p>
              </div>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                This secure review link expires in ${REVIEW_LINK_TTL_HOURS / 24} days. Recruiters signed into the workspace can continue to access the application internally after the email link expires.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${reviewLink}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Review Application
                </a>
              </div>
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; word-break: break-all;">
                If the button does not open, copy this URL into your browser:<br>
                <a href="${reviewLink}" style="color: #2563eb; text-decoration: none;">${reviewLink}</a>
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
        to: recipientEmails,
        subject: `New application submitted - ${safeReferenceNumber} - ${safePosition}`,
        html,
      }),
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.json()
      throw new Error(`Email send failed: ${JSON.stringify(error)}`)
    }

    const result = await emailResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Recruiter review email sent successfully',
        emailId: result.id,
        recipients: recipientEmails.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
