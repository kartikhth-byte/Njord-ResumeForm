// supabase/functions/send-expiry-notification/index.ts
// Sends expiry warning emails to applicant and recruiter

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface NotificationRequest {
  documentExpiryId: string
  applicantEmail: string
  applicantName: string
  documentType: string
  documentName: string
  expiryDate: string
  daysUntilExpiry: number
  notificationType: '90_day' | '60_day' | '30_day' | 'expired'
  warningLevel: 'moderate' | 'urgent' | 'critical'
  applicationId: string
  referenceNumber: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: NotificationRequest = await req.json()

    const {
      applicantEmail,
      applicantName,
      documentName,
      expiryDate,
      daysUntilExpiry,
      notificationType,
      warningLevel,
      referenceNumber
    } = payload

    // Determine urgency styling and messaging
    const urgencyConfig = {
      expired: {
        color: '#DC2626',
        bgColor: '#FEE2E2',
        icon: '🔴',
        title: 'EXPIRED',
        message: 'This document has expired and requires immediate renewal.'
      },
      critical: {
        color: '#EA580C',
        bgColor: '#FFEDD5',
        icon: '🟠',
        title: 'URGENT',
        message: 'This document will expire very soon. Please renew immediately.'
      },
      urgent: {
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        icon: '🟡',
        title: 'ACTION REQUIRED',
        message: 'This document will expire soon. Please plan for renewal.'
      },
      moderate: {
        color: '#10B981',
        bgColor: '#D1FAE5',
        icon: '🟢',
        title: 'REMINDER',
        message: 'This document will expire in the coming months. Please prepare for renewal.'
      }
    }

    const config = urgencyConfig[warningLevel]
    const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Email subject
    const isExpired = daysUntilExpiry < 0
    const subject = isExpired
      ? `${config.icon} EXPIRED: ${documentName} - Action Required`
      : `${config.icon} Expiry Warning: ${documentName} (${Math.abs(daysUntilExpiry)} days)`

    // Applicant Email HTML
    const applicantHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Expiry Warning</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">${config.icon}</div>
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">
                Document Expiry ${config.title}
              </h1>
            </td>
          </tr>

          <!-- Alert Box -->
          <tr>
            <td style="padding: 30px;">
              <div style="background-color: ${config.bgColor}; border-left: 4px solid ${config.color}; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <p style="margin: 0; color: ${config.color}; font-weight: 600; font-size: 16px;">
                  ${config.message}
                </p>
              </div>

              <!-- Greeting -->
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Dear ${applicantName},
              </p>

              <!-- Main Message -->
              <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                ${isExpired 
                  ? `Your <strong>${documentName}</strong> has expired and requires immediate renewal.`
                  : `Your <strong>${documentName}</strong> will expire in <strong>${Math.abs(daysUntilExpiry)} days</strong>.`
                }
              </p>

              <!-- Document Details Card -->
              <div style="background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 600;">
                  📄 Document Details
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Document:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${documentName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Expiry Date:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Days ${isExpired ? 'Overdue' : 'Remaining'}:</td>
                    <td style="padding: 8px 0; color: ${config.color}; font-size: 18px; font-weight: 700;">${Math.abs(daysUntilExpiry)} days</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reference:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${referenceNumber}</td>
                  </tr>
                </table>
              </div>

              <!-- Action Required -->
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
                  ✅ Action Required:
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
                  <li>Prepare renewal documentation</li>
                  <li>Schedule appointment with issuing authority</li>
                  <li>Complete renewal process before expiry</li>
                  <li>Upload renewed document to your application</li>
                </ol>
              </div>

              <!-- Important Note -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Important:</strong> Expired documents may affect your eligibility for maritime positions. 
                  Please renew as soon as possible to avoid any disruption in your career.
                </p>
              </div>

              <!-- Closing -->
              <p style="margin: 0 0 10px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                If you have any questions or need assistance, please contact our recruitment team.
              </p>

              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Best regards,<br>
                <strong>NJORD Ships Recruitment Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                This is an automated notification from NJORD Ships
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Reference: ${referenceNumber} | Document: ${documentName}
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

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NJORD Ships <onboarding@resend.dev>',
        to: [applicantEmail],
        subject: subject,
        html: applicantHtml,
      }),
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.json()
      throw new Error(`Email send failed: ${JSON.stringify(error)}`)
    }

    const result = await emailResponse.json()

    console.log(`Expiry notification sent to ${applicantEmail} for ${documentName}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Expiry notification sent',
        emailId: result.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})