// supabase/functions/process-expiry-warnings/index.ts
// Checks for expiring/expired documents and sends warning emails
// Run daily via cron job

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting expiry warnings check...')

    // Get all documents that need warnings
    const { data: expiringDocs, error: queryError } = await supabaseClient
      .rpc('get_documents_needing_warnings')

    if (queryError) {
      console.error('Error fetching expiring documents:', queryError)
      throw queryError
    }

    console.log(`Found ${expiringDocs?.length || 0} documents needing warnings`)

    const results = {
      total_checked: expiringDocs?.length || 0,
      warnings_sent: 0,
      errors: 0,
      details: []
    }

    // Process each document
    for (const doc of expiringDocs || []) {
      try {
        const daysUntil = doc.days_until_expiry
        let notificationType = ''
        let warningLevel = ''

        // Determine notification type
        if (doc.is_expired) {
          notificationType = 'expired'
          warningLevel = 'critical'
        } else if (daysUntil <= 30) {
          notificationType = '30_day'
          warningLevel = 'critical'
        } else if (daysUntil <= 60) {
          notificationType = '60_day'
          warningLevel = 'urgent'
        } else if (daysUntil <= 90) {
          notificationType = '90_day'
          warningLevel = 'moderate'
        } else {
          continue // Skip documents > 90 days
        }

        // Check if notification already sent
        const { data: existingNotif } = await supabaseClient
          .from('expiry_notifications')
          .select('id')
          .eq('document_expiry_id', doc.id)
          .eq('notification_type', notificationType)
          .single()

        if (existingNotif) {
          console.log(`Notification already sent for ${doc.document_name} (${notificationType})`)
          continue
        }

        // Send email notification
        const { error: emailError } = await supabaseClient.functions.invoke('send-expiry-notification', {
          body: {
            documentExpiryId: doc.id,
            applicantEmail: doc.applicant_email,
            applicantName: doc.applicant_name,
            documentType: doc.document_type,
            documentName: doc.document_name,
            expiryDate: doc.expiry_date,
            daysUntilExpiry: daysUntil,
            notificationType: notificationType,
            warningLevel: warningLevel,
            applicationId: doc.application_id,
            referenceNumber: doc.reference_number
          }
        })

        if (emailError) {
          console.error(`Error sending email for ${doc.document_name}:`, emailError)
          
          // Log failed notification
          await supabaseClient
            .from('expiry_notifications')
            .insert({
              document_expiry_id: doc.id,
              application_id: doc.application_id,
              user_id: doc.user_id,
              notification_type: notificationType,
              warning_level: warningLevel,
              sent_to_applicant: false,
              sent_to_recruiter: false,
              applicant_email: doc.applicant_email,
              status: 'failed',
              error_message: emailError.message,
              scheduled_for: new Date().toISOString()
            })
          
          results.errors++
          results.details.push({
            document: doc.document_name,
            status: 'failed',
            error: emailError.message
          })
        } else {
          console.log(`Successfully sent ${notificationType} warning for ${doc.document_name}`)
          
          // Log successful notification
          await supabaseClient
            .from('expiry_notifications')
            .insert({
              document_expiry_id: doc.id,
              application_id: doc.application_id,
              user_id: doc.user_id,
              notification_type: notificationType,
              warning_level: warningLevel,
              sent_to_applicant: true,
              sent_to_recruiter: true,
              applicant_email: doc.applicant_email,
              subject: `Document Expiry ${warningLevel === 'critical' ? 'URGENT' : 'Warning'}: ${doc.document_name}`,
              template_used: 'expiry_warning',
              status: 'sent',
              sent_at: new Date().toISOString(),
              scheduled_for: new Date().toISOString()
            })
          
          results.warnings_sent++
          results.details.push({
            document: doc.document_name,
            type: notificationType,
            status: 'sent',
            recipient: doc.applicant_email
          })
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error)
        results.errors++
        results.details.push({
          document: doc.document_name,
          status: 'error',
          error: error.message
        })
      }
    }

    console.log('Expiry warnings check completed:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.total_checked} documents, sent ${results.warnings_sent} warnings, ${results.errors} errors`,
        results: results
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