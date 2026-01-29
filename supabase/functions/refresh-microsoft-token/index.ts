import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! } 
        } 
      }
    )

    // Get user ID from request
    const { userId } = await req.json()
    
    console.log('🔄 Token refresh requested for user:', userId)

    // Get current refresh token from database
    const { data: tokenData, error: fetchError } = await supabaseClient
      .from('microsoft_oauth_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching token:', fetchError)
      throw new Error('Failed to fetch refresh token')
    }

    if (!tokenData?.refresh_token) {
      console.error('❌ No refresh token found for user:', userId)
      throw new Error('No refresh token available')
    }

    console.log('🔍 Found refresh token, requesting new access token...')

    // Exchange refresh token for new access token
    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: new URLSearchParams({
          client_id: Deno.env.get('MICROSOFT_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? '',
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
          scope: 'OnlineMeetings.ReadWrite User.Read offline_access',
        }),
      }
    )

    const newTokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('❌ Token refresh failed:', newTokens)
      throw new Error(newTokens.error_description || 'Token refresh failed')
    }

    console.log('✅ New tokens received, updating database...')

    // Calculate new expiration time
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000)

    // Update database with new tokens
    const { error: updateError } = await supabaseClient
      .from('microsoft_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || tokenData.refresh_token, // Use new refresh token if provided
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (updateError) {
      console.error('❌ Error updating tokens:', updateError)
      throw updateError
    }

    console.log('✅ Token refresh successful! New expiration:', expiresAt.toISOString())

    return new Response(
      JSON.stringify({ 
        success: true,
        expiresAt: expiresAt.toISOString() 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('❌ Token refresh error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})