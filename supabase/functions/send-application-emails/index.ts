// supabase/functions/send-application-emails/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  applicationId: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { applicationId } = await req.json() as EmailRequest
    
    if (!applicationId) {
      throw new Error('applicationId is required')
    }

    console.log('Processing application:', applicationId)

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get application data
    const { data: application, error: appError } = await supabaseClient
      .from('applications')
      .select(`
        *,
        application_data (data)
      `)
      .eq('id', applicationId)
      .single()

    if (appError) {
      console.error('Error fetching application:', appError)
      throw new Error(`Failed to fetch application: ${appError.message}`)
    }

    if (!application) {
      throw new Error('Application not found')
    }

    // Check if application has reference number
    if (!application.reference_number) {
      throw new Error('Application missing reference number')
    }

    const appData = application.application_data?.data || {}
    
    // Get recruiter email from settings
    const { data: settings } = await supabaseClient
      .from('recruiter_settings')
      .select('setting_value')
      .eq('setting_key', 'recruiter_email')
      .single()

    const recruiterEmail = settings?.setting_value || Deno.env.get('RECRUITER_EMAIL') || 'kartik.hth@gmail.com'

    // Helper function to format display values
    const formatDisplayValue = (value: string | undefined) => {
      if (!value) return 'Not specified'
      return value
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }

    // Prepare email data
    const applicantName = `${appData.section2?.firstName || ''} ${appData.section2?.middleName || ''} ${appData.section2?.surname || ''}`.trim()
    const applicantEmail = appData.section2?.email || 'Not provided'
    const applicantPhone = appData.section2?.phoneNumber || 'Not provided'
    const position = formatDisplayValue(appData.section1?.appliedForRank)
    const vesselType = formatDisplayValue(appData.section1?.vesselType)
    const nationality = appData.section2?.nationality || 'Not specified'
    const availableFrom = appData.section1?.availableFrom || 'Not specified'
    const referenceNumber = application.reference_number
    
    const submittedDate = new Date(application.submitted_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    // Resume view link
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'
    const resumeLink = `${appUrl}/view/${application.public_token}`

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    console.log('Sending email to recruiter:', recruiterEmail)
    console.log('Reference number:', referenceNumber)

    // Recruiter notification email HTML
    const recruiterEmailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: #ffffff; 
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #059669 0%, #047857 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 { 
              margin: 0; 
              font-size: 28px; 
              font-weight: 600;
            }
            .header p { 
              margin: 10px 0 0 0; 
              opacity: 0.95; 
              font-size: 16px;
            }
            .content { 
              padding: 30px; 
            }
            .ref-number {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin: 20px 0;
              border: 2px solid #1d4ed8;
            }
            .ref-number-label {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              opacity: 0.9;
              margin-bottom: 8px;
            }
            .ref-number-value {
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 2px;
              font-family: 'Courier New', monospace;
            }
            .button { 
              display: inline-block; 
              background: #059669; 
              color: white !important; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0; 
              font-weight: 600; 
              font-size: 16px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .button:hover {
              background: #047857;
            }
            .alert { 
              background: #fef3c7; 
              border-left: 4px solid #f59e0b; 
              padding: 16px; 
              margin: 20px 0; 
              border-radius: 4px; 
            }
            .alert strong { 
              color: #92400e; 
            }
            .details { 
              background: #f9fafb; 
              padding: 24px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border: 1px solid #e5e7eb; 
            }
            .details h3 { 
              margin-top: 0; 
              color: #1f2937; 
              font-size: 18px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .detail-row { 
              padding: 12px 0; 
              border-bottom: 1px solid #e5e7eb; 
              display: flex; 
            }
            .detail-row:last-child { 
              border-bottom: none; 
            }
            .label { 
              font-weight: 600; 
              color: #6b7280; 
              min-width: 160px; 
            }
            .value { 
              color: #1f2937; 
              flex: 1;
            }
            .footer { 
              text-align: center; 
              padding: 20px; 
              color: #6b7280; 
              font-size: 12px; 
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .link-box { 
              background: #eff6ff; 
              padding: 16px; 
              border-radius: 6px; 
              margin: 20px 0; 
              text-align: center;
              border: 1px solid #dbeafe;
            }
            .link-box p {
              margin: 0 0 8px 0; 
              font-weight: 600; 
              color: #1e40af;
              font-size: 14px;
            }
            .link-box a { 
              color: #2563eb; 
              word-break: break-all; 
              font-size: 13px;
              text-decoration: none;
            }
            .link-box a:hover {
              text-decoration: underline;
            }
            .applicant-name {
              color: #059669;
              font-size: 24px;
              font-weight: 600;
              margin: 20px 0 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Application Received</h1>
              <p>Njordships Maritime Recruitment Portal</p>
            </div>
            <div class="content">
              <div class="alert">
                <strong>⚡ Action Required:</strong> New maritime application awaiting your review
              </div>

              <div class="ref-number">
                <div class="ref-number-label">Application Reference Number</div>
                <div class="ref-number-value">${referenceNumber}</div>
              </div>

              <div class="applicant-name">${applicantName}</div>
              <p style="color: #6b7280; margin-top: 0; font-size: 15px;">
                has applied for the position of <strong style="color: #1f2937;">${position}</strong>
              </p>
              
              <div class="details">
                <h3>📋 Applicant Summary</h3>
                <div class="detail-row">
                  <span class="label">Reference Number:</span>
                  <span class="value"><strong>${referenceNumber}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="label">Position Applied:</span>
                  <span class="value">${position}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Preferred Vessel:</span>
                  <span class="value">${vesselType}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Nationality:</span>
                  <span class="value">${nationality}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Available From:</span>
                  <span class="value">${availableFrom}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Email:</span>
                  <span class="value">${applicantEmail}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Phone:</span>
                  <span class="value">${applicantPhone}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Submitted:</span>
                  <span class="value">${submittedDate}</span>
                </div>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resumeLink}" class="button">→ View Complete Resume</a>
              </div>

              <div class="link-box">
                <p>📎 Direct Resume Link</p>
                <a href="${resumeLink}">${resumeLink}</a>
              </div>

              <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 30px;">
                💡 <strong>Tip:</strong> Use reference number <strong>${referenceNumber}</strong> to search in the recruiter dashboard
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">Njordships Maritime Recruitment System</p>
              <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email using Resend (single email, not batch)
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'Njordships Recruitment <onboarding@resend.dev>',
        to: recruiterEmail,
        subject: `New Application: ${applicantName} - ${position} [${referenceNumber}]`,
        html: recruiterEmailBody
      })
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData)
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`)
    }

    console.log('Email sent successfully:', resendData)

    // Update application with email sent status
    const { error: updateError } = await supabaseClient
      .from('applications')
      .update({
        recruiter_email_sent: true,
        recruiter_email_sent_at: new Date().toISOString()
      })
      .eq('id', applicationId)

    if (updateError) {
      console.error('Error updating application:', updateError)
      // Don't throw - email was sent successfully
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Recruiter notification sent successfully',
        emailId: resendData.id,
        referenceNumber: referenceNumber
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
        error: error.message || 'An error occurred',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})