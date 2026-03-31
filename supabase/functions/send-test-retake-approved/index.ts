// supabase/functions/send-test-retake-approved/index.ts
// Sends test retake approval email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestRetakeRequest {
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  testLink: string
  expiryDate: string
  attemptNumber: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const runtimeSettings = await getRuntimeSettings(['RESEND_API_KEY', 'EMAIL_FROM'])
    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || 'NJORD Ships <onboarding@resend.dev>'

    const {
      applicantEmail,
      applicantName,
      referenceNumber,
      testLink,
      expiryDate,
      attemptNumber
    }: TestRetakeRequest = await req.json()

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
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">NJORD Ships</h1>
              <p style="margin: 5px 0 0 0; color: #e0e7ff; font-size: 14px;">Maritime Recruitment Excellence</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">🔄 Assessment Retake Approved</h2>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">Dear ${applicantName},</p>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">We're pleased to inform you that your request for a retake of the assessment has been <strong>approved</strong>.</p>
              
              <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">ℹ️ This is your ${attemptNumber === 2 ? 'final' : 'second'} attempt for this assessment.</p>
              </div>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">Click the button below to begin your retake:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${testLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">Start Retake</a>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">⏰ <strong>Link expires:</strong> ${expiryDate}</p>
              </div>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;"><strong>Tips for Success:</strong></p>
              
              <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                <li>Review any materials or guidelines provided</li>
                <li>Ensure you're in a quiet environment</li>
                <li>Take your time and read questions carefully</li>
                <li>Double-check your answers before submitting</li>
              </ul>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">We wish you the best of luck!</p>
              
              <p style="margin: 30px 0 0 0; color: #475569; font-size: 16px; line-height: 1.6;">Best regards,<br><strong>NJORD Ships Recruitment Team</strong></p>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">NJORD Ships - Your Partner in Maritime Excellence</p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;"><a href="https://njordships.com" style="color: #3b82f6; text-decoration: none;">Website</a> | <a href="mailto:hr@njordships.com" style="color: #3b82f6; text-decoration: none;">Contact Support</a></p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">© ${new Date().getFullYear()} NJORD Ships. All rights reserved.</p>
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
        subject: `Assessment Retake Approved - ${referenceNumber}`,
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
