// supabase/functions/send-interview-passed/index.ts
// Sends congratulatory email when candidate passes interview

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface InterviewPassedEmailRequest {
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  position: string
  recommendation?: string
  nextSteps?: string
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const runtimeSettings = await getRuntimeSettings(['RESEND_API_KEY', 'EMAIL_FROM'])
    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || 'NJORD Ships <onboarding@resend.dev>'

    const {
      applicantEmail,
      applicantName,
      referenceNumber,
      position,
      recommendation,
      nextSteps
    }: InterviewPassedEmailRequest = await req.json()

    console.log('Sending interview passed email to:', applicantEmail)

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [applicantEmail],
        subject: `🎉 Congratulations! Interview Passed - ${referenceNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Passed</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🎉 Congratulations!</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">You've Successfully Passed the Interview</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Dear <strong>${applicantName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We're delighted to inform you that you have <strong>successfully passed the interview</strong> for the <strong>${position}</strong> position with NJORD Ships.
              </p>

              ${recommendation ? `
              <div style="background-color: #dcfce7; border-left: 4px solid #22c55e; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; color: #166534; font-size: 15px; line-height: 1.5;">
                  <strong>Interviewer's Feedback:</strong><br>
                  ${recommendation}
                </p>
              </div>
              ` : ''}

              <!-- Application Reference -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 25px 0; border-radius: 6px;">
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Application Reference:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${referenceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Position:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${position}</td>
                  </tr>
                </table>
              </div>

              <!-- Next Steps -->
              <div style="margin: 30px 0;">
                <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 600;">📋 Next Steps</h2>
                <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                  ${nextSteps || 'Our recruitment team will be in touch shortly with details about the next stage of the hiring process. This may include:'}
                </p>
                ${!nextSteps ? `
                <ul style="margin: 0; padding-left: 25px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li>Formal offer letter preparation</li>
                  <li>Reference checks and background verification</li>
                  <li>Medical examination and documentation</li>
                  <li>Contract discussion and negotiation</li>
                </ul>
                ` : ''}
              </div>

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We're excited about the possibility of having you join the NJORD Ships team and look forward to the next steps in this process.
              </p>

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                If you have any questions, please don't hesitate to reach out to our recruitment team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: 600;">Best regards,</p>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 15px;">NJORD Ships Recruitment Team</p>
              
              <div style="margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                  NJORD Ships Maritime Recruitment<br>
                  <a href="mailto:recruitment@njordships.com" style="color: #3b82f6; text-decoration: none;">recruitment@njordships.com</a>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      })
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('Resend API error:', errorText)
      throw new Error(`Failed to send email: ${errorText}`)
    }

    const emailData = await emailResponse.json()
    console.log('Email sent successfully:', emailData)

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in send-interview-passed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
