import { createAdminSupabaseClient } from './runtime-settings.ts'

export async function requireApplicationEditor(
  req: Request,
  corsHeaders: Record<string, string>,
  allowServiceRole = false,
): Promise<Response | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (allowServiceRole && serviceRoleKey && token === serviceRoleKey) return null

  const admin = createAdminSupabaseClient()
  const { data: { user }, error: authError } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null }, error: null }
  const { data: allowed, error: permissionError } = user && !authError
    ? await admin.rpc('has_permission', {
        user_uuid: user.id,
        permission_name: 'edit_junction_status',
      })
    : { data: false, error: null }

  if (allowed === true && !permissionError) return null
  return new Response(JSON.stringify({ error: 'Application workflow permission required' }), {
    status: user ? 403 : 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
