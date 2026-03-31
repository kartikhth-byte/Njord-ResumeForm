import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, subject, startDateTime, endDateTime } = await req.json()
    const runtimeSettings = await getRuntimeSettings([
      'MICROSOFT_TENANT_ID',
      'MICROSOFT_CLIENT_ID',
      'MICROSOFT_CLIENT_SECRET',
    ])

    // Get user's access token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: tokenData, error } = await supabase
      .from('microsoft_oauth_tokens')
      .select('access_token, expires_at, refresh_token')
      .eq('user_id', userId)
      .single()

    if (error || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if token expired
    let accessToken = tokenData.access_token
    if (new Date(tokenData.expires_at) <= new Date()) {
      // Refresh token
      const refreshed = await refreshToken(tokenData.refresh_token, userId, supabase, runtimeSettings)
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: 'Token expired, please reconnect' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      accessToken = refreshed.access_token
    }

    // Create Teams meeting
    const meetingResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/onlineMeetings',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDateTime,
          endDateTime,
          subject: subject || 'Interview',
        }),
      }
    )

    if (!meetingResponse.ok) {
      const error = await meetingResponse.text()
      throw new Error(`Failed to create meeting: ${error}`)
    }

    const meeting = await meetingResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        joinUrl: meeting.joinWebUrl,
        meetingId: meeting.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating Teams meeting:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function refreshToken(refreshToken: string, userId: string, supabase: any, runtimeSettings: Record<string, string>) {
  try {
    const tokenUrl = `https://login.microsoftonline.com/${runtimeSettings.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: runtimeSettings.MICROSOFT_CLIENT_ID,
        client_secret: runtimeSettings.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) return null

    const tokens = await response.json()
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))

    await supabase.from('microsoft_oauth_tokens').update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    return tokens
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}
