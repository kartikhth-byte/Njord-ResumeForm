// supabase/functions/send-application-received/index.ts
// Sends confirmation email when application is submitted

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApplicationReceivedRequest {
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  position: string
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
      position
    }: ApplicationReceivedRequest = await req.json()

    // Email HTML
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
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                NJORD Ships
              </h1>
              <p style="margin: 5px 0 0 0; color: #e0e7ff; font-size: 14px;">
                Maritime Recruitment Excellence
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">
                Application Received ✓
              </h2>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Dear ${applicantName},
              </p>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Thank you for applying for the position of <strong>${position}</strong> at NJORD Ships.
              </p>
              
              <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;">
                  <strong>Application Reference:</strong>
                </p>
                <p style="margin: 0; color: #1e40af; font-size: 20px; font-weight: bold; font-family: monospace;">
                  ${referenceNumber}
                </p>
              </div>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Your application is now under review. Our recruitment team will carefully assess your qualifications and experience.
              </p>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                <strong>What happens next?</strong>
              </p>
              
              <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                <li>We'll review your application within 3-5 business days</li>
                <li>If selected, you'll receive an invitation for an online assessment</li>
                <li>Successful candidates will be invited for an interview</li>
              </ul>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                If you have any questions, please don't hesitate to contact us at 
                <a href="mailto:hr@njordships.com" style="color: #3b82f6; text-decoration: none;">hr@njordships.com</a>
              </p>
              
              <p style="margin: 30px 0 0 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Best regards,<br>
                <strong>NJORD Ships Recruitment Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">
                NJORD Ships - Your Partner in Maritime Excellence
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                <a href="https://njordships.com" style="color: #3b82f6; text-decoration: none;">Website</a> | 
                <a href="mailto:hr@njordships.com" style="color: #3b82f6; text-decoration: none;">Contact Support</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">
                © ${new Date().getFullYear()} NJORD Ships. All rights reserved.
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

    // Send via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [applicantEmail],
        subject: `Application Received - ${referenceNumber} - ${position}`,
        html: html,
      }),
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.json()
      throw new Error(`Email send failed: ${JSON.stringify(error)}`)
    }

    const result = await emailResponse.json()

    console.log(`Application received email sent to ${applicantEmail}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
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
