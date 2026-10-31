// supabase/functions/send-offer-letter/index.ts
// Sends offer letter to candidate - supports both form details and uploaded documents

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { BRAND } from '../_shared/branding.ts'

interface OfferLetterFormMode {
  mode: 'form'
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  position: string
  vesselType?: string
  vesselName?: string
  salary: string
  contractDuration: string
  joiningDate: string
  additionalBenefits?: string
}

interface OfferLetterUploadMode {
  mode: 'upload'
  applicantEmail: string
  applicantName: string
  referenceNumber: string
  documentUrl: string
  documentName: string
}

type OfferLetterRequest = OfferLetterFormMode | OfferLetterUploadMode

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const runtimeSettings = await getRuntimeSettings(['RESEND_API_KEY', 'EMAIL_FROM'])
    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || `${BRAND.sender} <onboarding@resend.dev>`
    const payload: OfferLetterRequest = await req.json()
    const { mode, applicantEmail, applicantName, referenceNumber } = payload

    console.log('Sending offer letter to:', applicantEmail, 'Mode:', mode)

    let emailBody: any

    if (mode === 'upload') {
      // Upload mode - simple email with document attachment
      const { documentUrl, documentName } = payload as OfferLetterUploadMode

      // Fetch document from URL to get base64 content
      const docResponse = await fetch(documentUrl)
      if (!docResponse.ok) {
        throw new Error('Failed to fetch document from storage')
      }

      const docBuffer = await docResponse.arrayBuffer()
      const docBase64 = btoa(String.fromCharCode(...new Uint8Array(docBuffer)))

      emailBody = {
        from: emailFrom,
        to: [applicantEmail],
        subject: `🎉 Job offer${BRAND.from} - ${referenceNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Offer</title>
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
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">We're Delighted to Offer You a Position</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Dear <strong>${applicantName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We are pleased to extend an offer of employment to you${BRAND.with}. 
                Please find the complete offer letter attached to this email.
              </p>

              <!-- Attachment Notice -->}
              <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <svg style="width: 24px; height: 24px; color: #16a34a;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p style="margin: 0; color: #166534; font-weight: 600; font-size: 14px;">📎 Attachment</p>
                    <p style="margin: 4px 0 0 0; color: #166534; font-size: 14px;">${documentName}</p>
                  </div>
                </div>
              </div>

              <!-- Application Reference -->}
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 25px 0; border-radius: 6px;">
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Application Reference:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${referenceNumber}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Please review the attached offer letter carefully. If you have any questions, 
                please don't hesitate to contact our recruitment team.
              </p>

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We look forward to welcoming you aboard!
              </p>
            </td>
          </tr>

          <!-- Footer -->}
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: 600;">Congratulations once again!</p>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 15px;">${BRAND.team}</p>
              
              <div style="margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                  ${BRAND.contactLink}
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
        `,
        attachments: [
          {
            filename: documentName,
            content: docBase64
          }
        ]
      }

    } else {
      // Form mode - detailed email with all offer information
      const {
        position,
        vesselType,
        vesselName,
        salary,
        contractDuration,
        joiningDate,
        additionalBenefits
      } = payload as OfferLetterFormMode

      // Format joining date
      const formattedJoiningDate = new Date(joiningDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      emailBody = {
        from: emailFrom,
        to: [applicantEmail],
        subject: `🎉 Job Offer - ${position} Position - ${referenceNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Offer</title>
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
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">We're Delighted to Offer You a Position</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Dear <strong>${applicantName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We are pleased to extend an offer for the position of <strong>${position}</strong>${BRAND.with}. 
                Based on your qualifications, experience, and outstanding performance throughout our recruitment process, 
                we believe you will be a valuable addition to our team.
              </p>

              <!-- Offer Details Box -->
              <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 25px; margin: 25px 0;">
                <h2 style="margin: 0 0 20px 0; color: #166534; font-size: 18px; font-weight: 600;">Offer Details</h2>
                
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 10px 0; color: #4b5563; font-size: 14px; border-bottom: 1px solid #d1fae5;">Position:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #d1fae5;">${position}</td>
                  </tr>
                  ${vesselType ? `
                  <tr>
                    <td style="padding: 10px 0; color: #4b5563; font-size: 14px; border-bottom: 1px solid #d1fae5;">Vessel Type:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #d1fae5;">${vesselType}</td>
                  </tr>
                  ` : ''}
                  ${vesselName ? `
                  <tr>
                    <td style="padding: 10px 0; color: #4b5563; font-size: 14px; border-bottom: 1px solid #d1fae5;">Vessel Name:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #d1fae5;">${vesselName}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 10px 0; color: #4b5563; font-size: 14px; border-bottom: 1px solid #d1fae5;">Monthly Salary:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #d1fae5;">${salary}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #4b5563; font-size: 14px; border-bottom: 1px solid #d1fae5;">Contract Duration:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #d1fae5;">${contractDuration}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #4b5563; font-size: 14px;">Expected Joining Date:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${formattedJoiningDate}</td>
                  </tr>
                </table>
              </div>

              ${additionalBenefits ? `
              <!-- Additional Benefits -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px; font-weight: 600;">Additional Benefits</h3>
                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6; white-space: pre-line;">${additionalBenefits}</p>
              </div>
              ` : ''}

              <!-- Next Steps -->
              <div style="margin: 30px 0;">
                <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 600;">📋 Next Steps</h2>
                <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                  To proceed with this offer, please:
                </p>
                <ol style="margin: 0; padding-left: 25px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                  <li>Review the offer details carefully</li>
                  <li>Contact our recruitment team to confirm your acceptance</li>
                  <li>Complete any pending documentation requirements</li>
                  <li>Arrange your travel and accommodation (if applicable)</li>
                </ol>
              </div>

              <!-- Application Reference -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 25px 0; border-radius: 6px;">
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Application Reference:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${referenceNumber}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We are excited about the prospect of you joining the team and contributing to our continued success. 
                If you have any questions about this offer, please don't hesitate to contact our recruitment team.
              </p>

              <p style="margin: 25px 0 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                We look forward to welcoming you aboard!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: 600;">Congratulations once again!</p>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 15px;">${BRAND.team}</p>
              
              <div style="margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                  ${BRAND.contactLink}
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
      }
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify(emailBody)
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('Resend API error:', errorText)
      throw new Error(`Failed to send email: ${errorText}`)
    }

    const emailData = await emailResponse.json()
    console.log('Offer letter email sent successfully:', emailData)

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in send-offer-letter:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
