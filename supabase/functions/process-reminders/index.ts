// supabase/functions/process-reminders/index.ts
// Daily cron job to process and send event reminders

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify this is a cron request (optional - add auth if needed)
    const authHeader = req.headers.get('authorization')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting reminder processing...')

    // Get all unsent reminders that are due
    const now = new Date()
    const { data: reminders, error: remindersError } = await supabaseClient
      .from('scheduled_reminders')
      .select(`
        *,
        scheduled_events (
          *,
          applications (
            id,
            user_id,
            reference_number
          )
        )
      `)
      .eq('sent', false)
      .lte('scheduled_for', now.toISOString())

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError)
      throw new Error(`Failed to fetch reminders: ${remindersError.message}`)
    }

    console.log(`Found ${reminders?.length || 0} reminders to process`)

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No reminders to process',
          processed: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const results = []
    let successCount = 0
    let failureCount = 0

    // Process each reminder
    for (const reminder of reminders) {
      try {
        console.log(`Processing reminder ${reminder.id} for event ${reminder.event_id}`)

        // Call send-event-notification with isReminder flag
        const notificationResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-event-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              eventId: reminder.event_id,
              isReminder: true
            })
          }
        )

        if (notificationResponse.ok) {
          // Mark reminder as sent
          const { error: updateError } = await supabaseClient
            .from('scheduled_reminders')
            .update({
              sent: true,
              sent_at: new Date().toISOString()
            })
            .eq('id', reminder.id)

          if (updateError) {
            console.error('Error updating reminder:', updateError)
          }

          successCount++
          results.push({
            reminderId: reminder.id,
            eventId: reminder.event_id,
            status: 'sent'
          })
          console.log(`✅ Reminder ${reminder.id} sent successfully`)
        } else {
          const errorText = await notificationResponse.text()
          console.error('Notification failed:', errorText)
          
          // Log error but don't mark as sent
          const { error: updateError } = await supabaseClient
            .from('scheduled_reminders')
            .update({
              error_message: errorText
            })
            .eq('id', reminder.id)

          failureCount++
          results.push({
            reminderId: reminder.id,
            eventId: reminder.event_id,
            status: 'failed',
            error: errorText
          })
          console.log(`❌ Reminder ${reminder.id} failed`)
        }
      } catch (reminderError) {
        console.error(`Error processing reminder ${reminder.id}:`, reminderError)
        failureCount++
        results.push({
          reminderId: reminder.id,
          eventId: reminder.event_id,
          status: 'error',
          error: reminderError.toString()
        })
      }
    }

    console.log(`Reminder processing complete: ${successCount} sent, ${failureCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${reminders.length} reminders`,
        successCount,
        failureCount,
        results
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