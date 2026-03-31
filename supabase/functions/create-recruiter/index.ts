import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_RECRUITER_ROLES = new Set(['Master Recruiter', 'Recruiter', 'Coordinator'])

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

    const getValidatedRole = async (requestedRoleId: string | null | undefined) => {
      if (!requestedRoleId) {
        throw new Error('role_id is required')
      }

      const { data: roleRecord, error: roleLookupError } = await supabaseClient
        .from('roles')
        .select('id, name')
        .eq('id', requestedRoleId)
        .maybeSingle()

      if (roleLookupError || !roleRecord) {
        throw new Error('Selected role was not found')
      }

      if (!ALLOWED_RECRUITER_ROLES.has(roleRecord.name)) {
        throw new Error('Selected role is not allowed for recruiter accounts')
      }

      return roleRecord
    }

    const countMasterRecruiters = async (excludeUserId?: string) => {
      const { data: masterRole, error: masterRoleError } = await supabaseClient
        .from('roles')
        .select('id')
        .eq('name', 'Master Recruiter')
        .maybeSingle()

      if (masterRoleError || !masterRole) {
        throw new Error('Master Recruiter role is not configured')
      }

      let query = supabaseClient
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role_id', masterRole.id)

      if (excludeUserId) {
        query = query.neq('user_id', excludeUserId)
      }

      const { count, error: countError } = await query

      if (countError) {
        throw new Error('Unable to verify master recruiter coverage')
      }

      return count ?? 0
    }

    const createRecruiterAccount = async ({
      fullName,
      emailAddress,
      rawPassword,
      roleId,
      assignedBy,
    }: {
      fullName: string
      emailAddress: string
      rawPassword: string
      roleId: string
      assignedBy: string
    }) => {
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email: emailAddress,
        password: rawPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      })

      if (authError) {
        throw new Error(authError.message)
      }

      const newUserId = authData.user.id

      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: newUserId,
          full_name: fullName,
          email: emailAddress,
          user_type: 'recruiter'
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        await supabaseClient.auth.admin.deleteUser(newUserId)
        throw new Error('Failed to create profile: ' + profileError.message)
      }

      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role_id: roleId,
          assigned_by: assignedBy ?? null
        })

      if (roleError) {
        await supabaseClient.auth.admin.deleteUser(newUserId)
        throw new Error('Failed to assign role: ' + roleError.message)
      }

      return newUserId
    }

    if (action === 'status') {
      const existingMasterRecruiters = await countMasterRecruiters()

      return new Response(
        JSON.stringify({
          setup_complete: existingMasterRecruiters > 0,
          master_recruiter_count: existingMasterRecruiters,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (action === 'bootstrap') {
      const existingMasterRecruiters = await countMasterRecruiters()

      if (existingMasterRecruiters > 0) {
        return new Response(
          JSON.stringify({ error: 'Initial setup is already complete.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { data: masterRole, error: masterRoleError } = await supabaseClient
        .from('roles')
        .select('id')
        .eq('name', 'Master Recruiter')
        .maybeSingle()

      if (masterRoleError || !masterRole) {
        return new Response(
          JSON.stringify({ error: 'Recruiter roles are not configured. Seed the roles table first.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      try {
        const newUserId = await createRecruiterAccount({
          fullName: full_name,
          emailAddress: email,
          rawPassword: password,
          roleId: masterRole.id,
          assignedBy: null,
        })

        return new Response(
          JSON.stringify({ success: true, user_id: newUserId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

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

      let validatedRole

      try {
        validatedRole = await getValidatedRole(role_id)
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      let newUserId

      try {
        newUserId = await createRecruiterAccount({
          fullName: full_name,
          emailAddress: email,
          rawPassword: password,
          roleId: validatedRole.id,
          assignedBy: caller.id,
        })
      } catch (error) {
        console.error('Recruiter creation error:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
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
          const validatedRole = await getValidatedRole(role_id)

          const { data: existingRoleRows, error: existingRoleError } = await supabaseClient
            .from('user_roles')
            .select(`
              role_id,
              roles (
                name
              )
            `)
            .eq('user_id', user_id)

          if (existingRoleError) {
            return new Response(
              JSON.stringify({ error: 'Failed to load current role assignments: ' + existingRoleError.message }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
          }

          const isCurrentlyMasterRecruiter = (existingRoleRows || []).some(
            row => row.roles?.name === 'Master Recruiter'
          )

          if (isCurrentlyMasterRecruiter && validatedRole.name !== 'Master Recruiter') {
            const remainingMasterRecruiters = await countMasterRecruiters(user_id)
            if (remainingMasterRecruiters === 0) {
              return new Response(
                JSON.stringify({ error: 'You cannot demote the last Master Recruiter. Promote another user first.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
              )
            }
          }

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
              role_id: validatedRole.id,
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

    if (action === 'delete') {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id is required for delete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      try {
        const { data: existingRoleRows, error: existingRoleError } = await supabaseClient
          .from('user_roles')
          .select(`
            role_id,
            roles (
              name
            )
          `)
          .eq('user_id', user_id)

        if (existingRoleError) {
          throw new Error('Failed to load recruiter role assignments: ' + existingRoleError.message)
        }

        const isMasterRecruiter = (existingRoleRows || []).some(
          row => row.roles?.name === 'Master Recruiter'
        )

        if (isMasterRecruiter) {
          const remainingMasterRecruiters = await countMasterRecruiters(user_id)
          if (remainingMasterRecruiters === 0) {
            throw new Error('You cannot delete the last Master Recruiter. Promote another user first.')
          }
        }

        const { error: roleDeleteError } = await supabaseClient
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)

        if (roleDeleteError) {
          throw new Error('Failed to remove role assignments: ' + roleDeleteError.message)
        }

        const { error: profileDeleteError } = await supabaseClient
          .from('profiles')
          .delete()
          .eq('id', user_id)

        if (profileDeleteError) {
          throw new Error('Failed to remove recruiter profile: ' + profileDeleteError.message)
        }

        const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(user_id)

        if (authDeleteError) {
          throw new Error('Recruiter profile was removed, but auth deletion failed: ' + authDeleteError.message)
        }

        await supabaseClient.from('audit_log').insert({
          user_id: caller.id,
          action: 'delete_recruiter',
          resource_type: 'user',
          resource_id: user_id,
          details: { deleted_user_id: user_id },
        })

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
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
