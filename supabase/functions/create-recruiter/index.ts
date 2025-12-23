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
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { action, full_name, email, password, role_id, user_id } = await req.json()

    console.log('Request received:', { action, email, role_id, user_id })

    // Get the authenticated user from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !caller) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    console.log('Caller authenticated:', caller.id)

    // Check if caller has manage_team permission
    const { data, error: permError } = await supabaseClient
      .rpc('has_permission', { user_uuid: caller.id, permission_name: 'manage_team' })

    console.log('Permission check result:', data, 'Error:', permError)

    if (permError || data !== true) {
      console.error('Permission denied. Data:', data, 'Error:', permError)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. User does not have manage_team permission.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    console.log('Permission granted!')

    // Handle CREATE action
    if (action === 'create') {
      console.log('Creating user with email:', email)

      // Create auth user
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      })

      if (authError) {
        console.error('Auth creation error:', authError)
        return new Response(
          JSON.stringify({ error: authError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const newUserId = authData.user.id
      console.log('User created:', newUserId)

      // Create profile
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .insert({
          id: newUserId,
          full_name,
          email,
          user_type: 'recruiter'
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        await supabaseClient.auth.admin.deleteUser(newUserId)
        return new Response(
          JSON.stringify({ error: 'Failed to create profile: ' + profileError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log('Profile created')

      // Assign role
      const { error: roleError } = await supabaseClient
  .from('user_roles')
        .insert({
          user_id: newUserId,
          role_id,
          assigned_by: caller.id
        })

      if (roleError) {
        console.error('Role assignment error:', roleError)
        await supabaseClient.auth.admin.deleteUser(newUserId)
        return new Response(
          JSON.stringify({ error: 'Failed to assign role: ' + roleError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log('Role assigned successfully')

      return new Response(
        JSON.stringify({ success: true, user_id: newUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Handle UPDATE action
    if (action === 'update') {
      console.log('=== STARTING UPDATE ===')
      console.log('user_id:', user_id)
      console.log('role_id:', role_id)
      console.log('full_name:', full_name)
      
      if (!user_id) {
        console.error('Missing user_id!')
        return new Response(
          JSON.stringify({ error: 'user_id is required for update' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      try {
        // Update full_name if provided
        if (full_name) {
          console.log('Updating full_name...')
          const { error: profileError } = await supabaseClient
            .from('profiles')
            .update({ full_name })
            .eq('id', user_id)

          if (profileError) {
            console.error('Profile update error:', profileError)
            return new Response(
              JSON.stringify({ error: 'Failed to update profile: ' + profileError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }
          console.log('Full name updated successfully')
        }

        // Update password if provided
        if (password) {
          console.log('Updating password...')
          const { error: passwordError } = await supabaseClient.auth.admin.updateUserById(
            user_id,
            { password }
          )

          if (passwordError) {
            console.error('Password update error:', passwordError)
            return new Response(
              JSON.stringify({ error: 'Failed to update password: ' + passwordError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }
          console.log('Password updated successfully')
        }

        // Update role if provided
        if (role_id) {
          console.log('Starting role update. New role_id:', role_id)
          
          // Delete old role assignments
          console.log('Deleting old role assignments for user:', user_id)
          const { data: deleteData, error: deleteError } = await supabaseClient
  .from('user_roles')
            .delete()
            .eq('user_id', user_id)

          console.log('Delete result - data:', deleteData, 'error:', deleteError)

          if (deleteError) {
            console.error('Delete error details:', JSON.stringify(deleteError))
            return new Response(
              JSON.stringify({ error: 'Failed to delete old role: ' + deleteError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          console.log('Old roles deleted, now inserting new role...')

          // Assign new role
          const { data: insertData, error: roleError } = await supabaseClient
  .from('user_roles')
            .insert({
              user_id,
              role_id,
              assigned_by: caller.id
            })

          console.log('Insert result - data:', insertData, 'error:', roleError)

          if (roleError) {
            console.error('Role insert error:', JSON.stringify(roleError))
            return new Response(
              JSON.stringify({ error: 'Failed to assign new role: ' + roleError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          console.log('New role assigned successfully!')
        }

        console.log('=== UPDATE COMPLETE ===')
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } catch (error) {
        console.error('=== UPDATE CAUGHT ERROR ===')
        console.error('Error:', error)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})