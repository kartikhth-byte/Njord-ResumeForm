// supabase/functions/schedule-event/index.ts
// Creates interview/test events and triggers email notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface ScheduleEventRequest {
  applicationId: string
  eventType: 'interview' | 'test'
  scheduledDate: string  // YYYY-MM-DD
  scheduledTime: string  // HH:MM
  durationMinutes?: number
  locationType?: 'physical' | 'virtual' | 'phone'
  locationAddress?: string
  locationLink?: string
  notes?: string
  interviewers?: string[]
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user is a recruiter
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (profile?.user_type !== 'recruiter') {
      throw new Error('Only recruiters can schedule events')
    }

    const { data: canSchedule, error: permissionError } = await supabaseClient
      .rpc('has_permission', { user_uuid: user.id, permission_name: 'schedule_interviews' })

    if (permissionError) {
      throw new Error(`Permission check failed: ${permissionError.message}`)
    }

    if (canSchedule !== true) {
      throw new Error('You do not have permission to schedule interviews')
    }

    // Parse request body
    const eventData = await req.json() as ScheduleEventRequest

    // Validate required fields
    if (!eventData.applicationId || !eventData.eventType || !eventData.scheduledDate || !eventData.scheduledTime) {
      throw new Error('Missing required fields')
    }

    console.log('Creating event:', eventData)

    // Get application details
    const { data: application, error: appError } = await supabaseClient
      .from('applications')
      .select(`
        *,
        profiles!applications_user_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .eq('id', eventData.applicationId)
      .single()

    if (appError || !application) {
      throw new Error('Application not found')
    }

    const normalizedLocationType =
      eventData.locationType === 'virtual'
        ? 'online'
        : eventData.locationType === 'physical'
          ? 'in-person'
          : eventData.locationType || 'online'

    const locationDetails = eventData.locationLink || eventData.locationAddress || null
    const eventTitle = `${eventData.eventType === 'interview' ? 'Interview' : 'Assessment Test'} - ${application.reference_number || application.id}`
    const eventDescription = eventData.notes || null
    const platform =
      normalizedLocationType === 'online'
        ? (eventData.locationLink ? 'Online Meeting' : 'Virtual')
        : normalizedLocationType === 'phone'
          ? 'Phone'
          : null

    // Create scheduled event
    const { data: event, error: eventError } = await supabaseClient
      .from('scheduled_events')
      .insert({
        application_id: eventData.applicationId,
        scheduled_by: user.id,
        event_type: eventData.eventType,
        event_title: eventTitle,
        event_description: eventDescription,
        scheduled_date: eventData.scheduledDate,
        scheduled_time: eventData.scheduledTime,
        duration_minutes: eventData.durationMinutes || 60,
        timezone: 'UTC',
        location_type: normalizedLocationType,
        location_details: locationDetails,
        platform,
        status: 'scheduled',
      })
      .select()
      .single()

    if (eventError) {
      console.error('Error creating event:', eventError)
      throw new Error(`Failed to create event: ${eventError.message}`)
    }

    console.log('Event created:', event.id)

    // Create 24-hour reminder
    const eventDateTime = new Date(`${eventData.scheduledDate}T${eventData.scheduledTime}:00`)
    const reminderTime = new Date(eventDateTime.getTime() - 24 * 60 * 60 * 1000) // 24 hours before

    const { error: reminderError } = await supabaseClient
      .from('scheduled_reminders')
      .insert({
        event_id: event.id,
        reminder_type: '24h_before',
        scheduled_for: reminderTime.toISOString()
      })

    if (reminderError) {
      console.error('Error creating reminder:', reminderError)
      // Don't fail the request
    }

    // Update application status
    const newStatus = eventData.eventType === 'interview' ? 'interview_scheduled' : 'test_scheduled'
    
    const { error: statusError } = await supabaseClient
      .from('applications')
      .update({ status: newStatus })
      .eq('id', eventData.applicationId)

    if (statusError) {
      console.error('Error updating application status:', statusError)
    }

    // Trigger email notification (call another edge function)
    const appUrl = Deno.env.get('APP_URL') || 'https://njord-resume-form.vercel.app'
    
    try {
      const notificationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-event-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          eventId: event.id
        })
      })

      if (!notificationResponse.ok) {
        const errorText = await notificationResponse.text()
        console.error('Error sending notification:', errorText)
        // Don't fail - event was created
      } else {
        console.log('Notification sent successfully')
      }
    } catch (notifError) {
      console.error('Error calling notification function:', notifError)
      // Don't fail - event was created
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${eventData.eventType === 'interview' ? 'Interview' : 'Test'} scheduled successfully`,
        event: event,
        reminderScheduled: !reminderError
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
