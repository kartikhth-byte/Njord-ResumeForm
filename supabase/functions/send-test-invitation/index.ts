// supabase/functions/send-test-invitation/index.ts
// Sends test invitation email with link and expiry date

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface TestInvitationRequest {
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  testLink: string
  expiryDate: string
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
      testLink,
      expiryDate
    }: TestInvitationRequest = await req.json()

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
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px;">📝 Assessment Invitation</h2>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">Dear ${applicantName},</p>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">Congratulations! Your application (<strong>${referenceNumber}</strong>) has progressed to the assessment stage.</p>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">Please click the button below to begin your online assessment:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${testLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">Start Assessment</a>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">⏰ <strong>Important:</strong> This link expires on ${expiryDate}</p>
              </div>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;"><strong>Assessment Guidelines:</strong></p>
              
              <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                <li>Estimated completion time: 45-60 minutes</li>
                <li>You can complete it in one sitting</li>
                <li>Ensure stable internet connection</li>
                <li>Use a desktop or laptop for best experience</li>
                <li>Complete before the expiry date</li>
              </ul>
              
              <p style="margin: 0 0 15px 0; color: #475569; font-size: 16px; line-height: 1.6;">Good luck! We look forward to reviewing your results.</p>
              
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
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NJORD Ships <onboarding@resend.dev>',
        to: [applicantEmail],
        subject: `Assessment Invitation - ${referenceNumber}`,
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