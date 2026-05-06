// supabase/functions/send-event-notification/index.ts
// Sends DUAL email notifications (applicant + recruiter) with calendar invites

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateICS } from '../_shared/ics-generator.ts'
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface NotificationRequest {
  eventId: string
  isReminder?: boolean
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const runtimeSettings = await getRuntimeSettings(['APP_URL', 'RESEND_API_KEY', 'EMAIL_FROM'])
    const { eventId, isReminder = false } = await req.json() as NotificationRequest

    if (!eventId) {
      throw new Error('eventId is required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // =========================================================================
    // STEP 1: Get event details (NO JOINS - avoid RLS issues)
    // =========================================================================
    const { data: event, error: eventError } = await supabaseClient
      .from('scheduled_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      console.error('Event fetch error:', eventError)
      throw new Error('Event not found')
    }

    // =========================================================================
    // STEP 2: Get application separately
    // =========================================================================
    const { data: application, error: appError } = await supabaseClient
      .from('applications')
      .select('*')
      .eq('id', event.application_id)
      .single()

    if (appError || !application) {
      console.error('Application fetch error:', appError)
      throw new Error('Application not found')
    }

    // =========================================================================
    // STEP 3: Get application_data separately
    // =========================================================================
    const { data: applicationData, error: appDataError } = await supabaseClient
      .from('application_data')
      .select('data')
      .eq('application_id', application.id)
      .single()

    if (appDataError) {
      console.error('Application data fetch error:', appDataError)
    }

    const appData = applicationData?.data || {}

    // =========================================================================
    // STEP 4: Get profile separately
    // =========================================================================
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', application.user_id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      throw new Error('User profile not found')
    }

    // =========================================================================
    // STEP 5: Extract needed data
    // =========================================================================
    
    // Get applicant name
    const applicantName = `${appData.section2?.firstName || ''} ${appData.section2?.surname || ''}`.trim() 
      || profile.full_name 
      || profile.email

    const applicantEmail = profile.email
    const position = appData.section1?.appliedForRank?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Position'
    const referenceNumber = application.reference_number

    // Get recruiter who created the event
    const { data: recruiterProfile } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', event.scheduled_by)
      .single()

    const recruiterEmail = recruiterProfile?.email || runtimeSettings.EMAIL_FROM || 'recruitment@njordships.com'
    const recruiterName = recruiterProfile?.full_name || 'NJORD Ships Recruitment'

    // Format date and time
const eventDate = new Date(`${event.scheduled_date}T${event.scheduled_time}`)
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    const formattedTime = eventDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })

    // Get environment variables
    const appUrl = runtimeSettings.APP_URL
    const resendApiKey = runtimeSettings.RESEND_API_KEY
    const emailFrom = runtimeSettings.EMAIL_FROM || 'Njordships Recruitment <onboarding@resend.dev>'

    if (!appUrl || !resendApiKey) {
      throw new Error('Missing required environment variables')
    }

    // Determine location string
    let locationString = 'To be confirmed'
    if (event.location_type === 'online' && event.location_details) {
      locationString = event.location_details
    } else if (event.location_type === 'in-person' && event.location_details) {
      locationString = event.location_details
    } else if (event.location_type === 'phone') {
      locationString = 'Phone Interview'
    } else if (event.location_details) {
      locationString = event.location_details
    }

    // Generate calendar invite (same for both)
    const icsContent = generateICS({
      summary: `${event.event_type === 'interview' ? 'Interview' : 'Test'} - ${position} - NJORD Ships`,
      description: `${event.event_type === 'interview' ? 'Interview' : 'Assessment Test'} for ${position} position at NJORD Ships.\\n\\nApplication Reference: ${referenceNumber}\\n${event.event_description ? `\\nNotes: ${event.event_description}` : ''}`,
      location: locationString,
      startDate: event.scheduled_date,
      startTime: event.scheduled_time,
      durationMinutes: event.duration_minutes,
      organizerEmail: recruiterEmail,
      organizerName: recruiterName,
      attendeeEmail: applicantEmail,
      attendeeName: applicantName,
      url: event.location_details || undefined
    })

    const icsBase64 = btoa(icsContent)

    // ===========================================================================
    // EMAIL 1: APPLICANT EMAIL (User-friendly, warm, helpful)
    // ===========================================================================
    
    const applicantSubject = isReminder 
      ? `Reminder: ${event.event_type === 'interview' ? 'Interview' : 'Test'} Tomorrow - ${position} [${referenceNumber}]`
      : `${event.event_type === 'interview' ? 'Interview' : 'Test'} Scheduled - ${position} [${referenceNumber}]`

    const applicantBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 30px; }
            .event-card { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .event-card h3 { margin-top: 0; color: #1e40af; }
            .detail-row { padding: 12px 0; border-bottom: 1px solid #e5e7eb; display: flex; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #6b7280; min-width: 140px; }
            .value { color: #1f2937; flex: 1; }
            .button { display: inline-block; background: #3b82f6; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9fafb; }
            .alert { background: ${isReminder ? '#fef3c7' : '#d1fae5'}; border-left: 4px solid ${isReminder ? '#f59e0b' : '#10b981'}; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .tip-box { background: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isReminder ? '⏰ Event Reminder' : '📅 Event Scheduled'}</h1>
              <p>NJORD Ships Maritime Recruitment</p>
            </div>
            <div class="content">
              ${isReminder ? `
                <div class="alert">
                  <strong>⚡ Tomorrow:</strong> Your ${event.event_type} is scheduled for tomorrow!
                </div>
              ` : `
                <div class="alert">
                  <strong>✅ Confirmed:</strong> Your ${event.event_type} has been scheduled
                </div>
              `}
              
              <h2>Hello ${applicantName},</h2>
              <p>Your ${event.event_type === 'interview' ? 'interview' : 'assessment test'} for the <strong>${position}</strong> position has been ${isReminder ? 'scheduled for tomorrow' : 'confirmed'}.</p>
              
              <div class="event-card">
                <h3>📋 Event Details</h3>
                <div class="detail-row">
                  <span class="label">Event Type:</span>
                  <span class="value">${event.event_type === 'interview' ? 'Interview' : 'Assessment Test'}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formattedTime}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Duration:</span>
                  <span class="value">${event.duration_minutes} minutes</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${locationString.startsWith('http') ? `<a href="${locationString}">${locationString}</a>` : locationString}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Reference:</span>
                  <span class="value"><strong>${referenceNumber}</strong></span>
                </div>
              </div>

              ${locationString.startsWith('http') ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${locationString}" class="button">🔗 Join Meeting</a>
                </div>
              ` : ''}

              <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  📎 <strong>Calendar Invite:</strong> Attached as .ics file. Add to your calendar.
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                If you have any questions, please contact our recruitment team.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">NJORD Ships Recruitment Management</p>
              <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} NJORD Ships</p>
            </div>
          </div>
        </body>
      </html>
    `

    // ===========================================================================
    // EMAIL 2: RECRUITER EMAIL (Professional, data-focused)
    // ===========================================================================
    
    const recruiterSubject = isReminder 
      ? `Reminder: ${event.event_type === 'interview' ? 'Interview' : 'Test'} Tomorrow - ${applicantName} [${referenceNumber}]`
      : `${event.event_type === 'interview' ? 'Interview' : 'Test'} Scheduled - ${applicantName} [${referenceNumber}]`

    const recruiterBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 30px; }
            .info-box { background: #faf5ff; border-left: 4px solid #7c3aed; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .detail-row { padding: 12px 0; border-bottom: 1px solid #e5e7eb; display: flex; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #6b7280; min-width: 140px; }
            .value { color: #1f2937; flex: 1; }
            .button { display: inline-block; background: #7c3aed; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9fafb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${isReminder ? '⏰ Event Reminder' : '📅 Event Scheduled'}</h1>
              <p>Recruiter Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${recruiterName},</h2>
              <p>${isReminder ? 'Reminder: This' : 'This'} ${event.event_type} is scheduled for ${isReminder ? 'tomorrow' : formattedDate}.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #7c3aed;">Applicant Information</h3>
                <div class="detail-row">
                  <span class="label">Name:</span>
                  <span class="value"><strong>${applicantName}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="label">Email:</span>
                  <span class="value">${applicantEmail}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Position:</span>
                  <span class="value">${position}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Reference:</span>
                  <span class="value"><strong>${referenceNumber}</strong></span>
                </div>
              </div>

              <div style="margin: 20px 0;">
                <h3 style="color: #1f2937; margin-bottom: 10px;">📋 Event Details</h3>
                <div class="detail-row">
                  <span class="label">Type:</span>
                  <span class="value">${event.event_type === 'interview' ? 'Interview' : 'Assessment Test'}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formattedTime}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Duration:</span>
                  <span class="value">${event.duration_minutes} minutes</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${locationString.startsWith('http') ? `<a href="${locationString}">Virtual Meeting</a>` : locationString}</span>
                </div>
                ${event.event_description ? `
                  <div class="detail-row">
                    <span class="label">Notes:</span>
                    <span class="value">${event.event_description}</span>
                  </div>
                ` : ''}
              </div>

              ${locationString.startsWith('http') ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${locationString}" class="button">📹 Join Meeting</a>
                  <a href="${appUrl}/recruiter/applications/${application.id}" class="button">📄 View Application</a>
                </div>
              ` : `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${appUrl}/recruiter/applications/${application.id}" class="button">📄 View Application</a>
                </div>
              `}

              <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  📎 <strong>Calendar Invite:</strong> Attached as .ics file. Add to your calendar.
                </p>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 0;">NJORD Ships Recruitment Management</p>
              <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Internal Use Only</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send applicant email
    const applicantResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: emailFrom,
        to: applicantEmail,
        subject: applicantSubject,
        html: applicantBody,
        attachments: [
          {
            filename: `njord-${event.event_type}-${referenceNumber}.ics`,
            content: icsBase64,
            content_type: 'text/calendar'
          }
        ]
      })
    })

    const applicantData = await applicantResponse.json()
    if (!applicantResponse.ok) {
      console.error('Applicant email failed:', applicantData)
    }

    // Send recruiter email
    const recruiterResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: emailFrom,
        to: recruiterEmail,
        subject: recruiterSubject,
        html: recruiterBody,
        attachments: [
          {
            filename: `njord-${event.event_type}-${referenceNumber}.ics`,
            content: icsBase64,
            content_type: 'text/calendar'
          }
        ]
      })
    })

    const recruiterData = await recruiterResponse.json()
    if (!recruiterResponse.ok) {
      console.error('Recruiter email failed:', recruiterData)
    }

    // Log both notifications
    await supabaseClient
      .from('notification_log')
      .insert([
        {
          user_id: application.user_id,
          application_id: application.id,
          event_id: eventId,
          notification_type: isReminder ? `${event.event_type}_reminder_applicant` : `${event.event_type}_scheduled_applicant`,
          template_name: isReminder ? `${event.event_type}-reminder-applicant` : `${event.event_type}-scheduled-applicant`,
          recipient_email: applicantEmail,
          recipient_name: applicantName,
          subject: applicantSubject,
          has_calendar_invite: true,
          status: applicantResponse.ok ? 'sent' : 'failed',
          sent_at: new Date().toISOString()
        },
        {
          user_id: event.scheduled_by,
          application_id: application.id,
          event_id: eventId,
          notification_type: isReminder ? `${event.event_type}_reminder_recruiter` : `${event.event_type}_scheduled_recruiter`,
          template_name: isReminder ? `${event.event_type}-reminder-recruiter` : `${event.event_type}-scheduled-recruiter`,
          recipient_email: recruiterEmail,
          recipient_name: recruiterName,
          subject: recruiterSubject,
          has_calendar_invite: true,
          status: recruiterResponse.ok ? 'sent' : 'failed',
          sent_at: new Date().toISOString()
        }
      ])

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Event notifications sent to both applicant and recruiter',
        applicantEmailId: applicantData.id,
        recruiterEmailId: recruiterData.id
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
