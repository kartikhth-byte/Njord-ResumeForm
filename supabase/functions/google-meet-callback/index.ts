// supabase/functions/google-meet-callback/index.ts
// Handles Google OAuth callback and exchanges code for tokens

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
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      throw new Error(`OAuth error: ${error}`)
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify state
    const { data: stateData, error: stateError } = await supabaseClient
      .from('google_oauth_states')
      .select('*')
      .eq('state', state)
      .single()

    if (stateError || !stateData) {
      throw new Error('Invalid state parameter')
    }

    // Check state not expired
    if (new Date(stateData.expires_at) < new Date()) {
      throw new Error('State expired')
    }

    const userId = stateData.user_id

    // Exchange code for tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth not configured')
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`)
    }

    const tokenData = await tokenResponse.json()

    // Store tokens in database
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    const { error: insertError } = await supabaseClient
      .from('google_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (insertError) {
      throw insertError
    }

    // Delete used state
    await supabaseClient
      .from('google_oauth_states')
      .delete()
      .eq('state', state)

    // Redirect to success page
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${appUrl}/recruiter/dashboard?google_auth=success`
      }
    })

  } catch (error) {
    console.error('Callback error:', error)
    
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${appUrl}/recruiter/dashboard?google_auth=error&message=${encodeURIComponent(error.message)}`
      }
    })
  }
})