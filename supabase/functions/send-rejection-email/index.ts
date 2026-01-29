// supabase/functions/send-rejection-email/index.ts
// Sends rejection notification at any stage (test, interview, or direct rejection)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RejectionEmailRequest {
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  position: string
  reason: string
  additionalFeedback?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      applicantEmail,
      applicantName,
      referenceNumber,
      position,
      reason,
      additionalFeedback
    }: RejectionEmailRequest = await req.json()

    console.log('Sending rejection email to:', applicantEmail)

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'NJORD Ships <onboarding@resend.dev>',
        to: [applicantEmail],
        subject: `Application Update - ${referenceNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Application Update</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">${referenceNumber}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Dear <strong>${applicantName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Thank you for your interest in the <strong>${position}</strong> position with NJORD Ships and for taking the time to participate in our recruitment process.
              </p>

              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.
              </p>

              <!-- Rejection Reason -->
              ${reason ? `
              <div style="background-color: #f3f4f6; border-left: 4px solid #9ca3af; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.5;">
                  <strong>Reason:</strong><br>
                  ${reason}
                </p>
              </div>
              ` : ''}

              <!-- Additional Feedback -->
              ${additionalFeedback ? `
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af; font-size: 15px; line-height: 1.5;">
                  <strong>Feedback:</strong><br>
                  ${additionalFeedback}
                </p>
              </div>
              ` : ''}

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We appreciate the effort you put into your application and the time you spent with us during the recruitment process. We encourage you to apply for other positions with NJORD Ships in the future that match your qualifications and experience.
              </p>

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We wish you all the best in your career endeavors and future maritime opportunities.
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
    console.error('Error in send-rejection-email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})