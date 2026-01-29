import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, userId } = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, message: 'No authorization code provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Exchange authorization code for access token
    const tokenUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/token`
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('MICROSOFT_CLIENT_ID') || '',
        client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') || '',
        code: code,
        redirect_uri: Deno.env.get('MICROSOFT_REDIRECT_URI') || '',
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData)
      return new Response(
        JSON.stringify({ success: false, message: tokenData.error_description || 'Token exchange failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // After token exchange, BEFORE database insert
console.log('🔍 Token Exchange Response:', JSON.stringify({
  access_token: tokenData.access_token ? `${tokenData.access_token.substring(0, 20)}...` : null,
  refresh_token: tokenData.refresh_token ? 'present' : 'MISSING',
  expires_in: tokenData.expires_in,
  scope: tokenData.scope,
  token_type: tokenData.token_type
}))

    // Store tokens in database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

   const { error: dbError } = await supabaseClient
  .from('microsoft_oauth_tokens')
  .upsert({
    user_id: userId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id'  // ← ADD THIS!
  })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to store tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Microsoft Teams connected successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in microsoft-oauth-callback:', error)
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})