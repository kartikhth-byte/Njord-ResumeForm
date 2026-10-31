// supabase/functions/send-interview-invitation/index.ts
// Sends interview invitation email with meeting details

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { BRAND } from '../_shared/branding.ts'

interface InterviewInvitationRequest {
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  interviewDate: string
  interviewTime: string
  meetingLink: string
  duration: number
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const runtimeSettings = await getRuntimeSettings(['RESEND_API_KEY', 'EMAIL_FROM'])
    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || `${BRAND.sender} <onboarding@resend.dev>`

    const {
      applicantEmail,
      applicantName,
      referenceNumber,
      interviewDate,
      interviewTime,
      meetingLink,
      duration
    }: InterviewInvitationRequest = await req.json()

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
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">${BRAND.name}</h1>
              <p style="margin: 5px 0 0 0; color: #e0e7ff; font-size: 14px;">Maritime Recruitment Excellence</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">🎉 Interview Invitation</h2>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">Dear ${applicantName},</p>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">Congratulations! We're impressed with your application and would like to invite you for an interview.</p>
              
              <div style="background-color: #dbeafe; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #3b82f6;">
                <p style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: bold;">📅 Interview Details</p>
                <p style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 15px;"><strong>Date:</strong> ${interviewDate}</p>
                <p style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 15px;"><strong>Time:</strong> ${interviewTime}</p>
                <p style="margin: 0; color: #1e3a8a; font-size: 15px;"><strong>Duration:</strong> Approximately ${duration || 45}-60 minutes</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${meetingLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3);">Join Interview Meeting</a>
              </div>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;"><strong>How to Prepare:</strong></p>
              
              <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                <li>Review your application and resume</li>
                <li>Research the company and its fleet</li>
                <li>Prepare questions about the role and company</li>
                <li>Test your camera and microphone beforehand</li>
                <li>Ensure stable internet connection</li>
                <li>Find a quiet, professional environment</li>
              </ul>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">ℹ️ <strong>Need to reschedule?</strong> Please contact us at least 24 hours in advance.</p>
              </div>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">We look forward to speaking with you!</p>
              
              <p style="margin: 30px 0 0 0; color: #475569; font-size: 16px; line-height: 1.6;">Best regards,<br><strong>${BRAND.team}</strong></p>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [applicantEmail],
        subject: `Interview Invitation - ${referenceNumber}`,
        html: html,
      }),
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.json()
      throw new Error(`Email send failed: ${JSON.stringify(error)}`)
    }

    const result = await emailResponse.json()

    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
