import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Webhook } from 'https://esm.sh/svix@1.74.0'
import { createAdminSupabaseClient, getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

type ResendWebhookEvent = {
  type?: string
  data?: {
    created_at?: string
    email_id?: string
    from?: string
    to?: string[]
    subject?: string
    tags?: Record<string, unknown>
    bounce?: Record<string, unknown>
    email?: string
  }
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    const runtimeSettings = await getRuntimeSettings(['RESEND_WEBHOOK_SECRET'])
    const webhookSecret = runtimeSettings.RESEND_WEBHOOK_SECRET?.trim()

    if (!webhookSecret) {
      throw new Error('RESEND_WEBHOOK_SECRET must be configured')
    }

    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return json({ error: 'Missing webhook signature headers' }, corsHeaders, 400)
    }

    const webhook = new Webhook(webhookSecret)
    let payload: ResendWebhookEvent

    try {
      payload = webhook.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ResendWebhookEvent
    } catch (verificationError) {
      console.error('Webhook verification failed:', verificationError)
      return json({ error: 'Invalid webhook signature' }, corsHeaders, 400)
    }

    const eventType = payload?.type || ''
    const eventData = payload?.data || {}
    if (!eventType.toLowerCase().includes('bounce')) {
      return json({ success: true, ignored: true }, corsHeaders)
    }

    const recipientEmail = eventData.to?.[0] || eventData.email || ''
    const prospectId = typeof eventData.tags?.prospect_id === 'string' ? eventData.tags.prospect_id : null
    const createdAt = eventData.created_at || new Date().toISOString()
    const supabaseClient = createAdminSupabaseClient()

    const { error: dedupeError } = await supabaseClient
      .from('prospect_email_webhook_events')
      .insert({
        svix_id: svixId,
        event_type: eventType,
        event_created_at: createdAt,
        payload: eventData,
      })
      .select('svix_id')
      .maybeSingle()

    if (dedupeError && !String(dedupeError.message || '').includes('duplicate key')) {
      throw dedupeError
    }

    if (dedupeError && String(dedupeError.message || '').includes('duplicate key')) {
      return json({ success: true, ignored: true, deduped: true }, corsHeaders)
    }

    const { data, error } = await supabaseClient.rpc('record_prospect_email_bounce', {
      p_recipient_email: recipientEmail,
      p_prospect_id: prospectId,
      p_event_payload: eventData,
      p_event_created_at: createdAt,
    })

    if (error) {
      throw error
    }

    return json({
      success: true,
      matched: data?.matched ?? false,
    }, corsHeaders)
  } catch (error) {
    console.error('prospect-email-bounce-webhook error:', error)
    return json({ error: error.message || 'An unexpected error occurred' }, corsHeaders, 500)
  }
})

function json(payload: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
