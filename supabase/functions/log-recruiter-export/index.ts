import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface LogRecruiterExportRequest {
  report_type?: string
  export_format?: 'csv' | 'pdf'
  row_ids_hash?: string
  row_count?: number
  notes_included?: boolean
  filters?: Record<string, unknown>
  sort?: Record<string, unknown>
  prospect_id?: string | null
  requirement_id?: string | null
  application_id?: string | null
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseClient = createAdminSupabaseClient()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, corsHeaders, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return json({ error: 'Invalid token' }, corsHeaders, 401)
    }

    const payload = (await req.json()) as LogRecruiterExportRequest
    const exportFormat = payload.export_format === 'pdf' ? 'pdf' : 'csv'
    const requiredFormatPermission = exportFormat === 'pdf' ? 'export_pdf' : 'export_csv'

    const [canExportAnyResult, canExportFormatResult] = await Promise.all([
      supabaseClient.rpc('has_permission', {
        user_uuid: user.id,
        permission_name: 'export_data',
      }),
      supabaseClient.rpc('has_permission', {
        user_uuid: user.id,
        permission_name: requiredFormatPermission,
      }),
    ])

    if (
      canExportAnyResult.error ||
      canExportFormatResult.error ||
      (canExportAnyResult.data !== true && canExportFormatResult.data !== true)
    ) {
      return json({ error: 'Insufficient permissions' }, corsHeaders, 403)
    }

    const { data: roleRows, error: roleError } = await supabaseClient
      .from('user_roles')
      .select(`
        roles (
          name
        )
      `)
      .eq('user_id', user.id)

    if (roleError) {
      throw roleError
    }

    const actorRole = (roleRows || []).map((row) => row.roles?.name).filter(Boolean)[0] || null
    const reportType = payload.report_type || 'report'
    const eventType = `export.${exportFormat}_exported`

    const { error: insertError } = await supabaseClient.from('audit_log').insert({
      entity_type: 'export',
      event_type: eventType,
      actor_type: 'recruiter',
      actor_user_id: user.id,
      actor_role_at_event: actorRole,
      system_actor: null,
      payload: {
        report_type: reportType,
        export_format: exportFormat,
        row_ids_hash: payload.row_ids_hash || null,
        row_count: payload.row_count ?? 0,
        notes_included: Boolean(payload.notes_included),
        filters: payload.filters || {},
        sort: payload.sort || {},
        report_context: payload.report_type || null,
        prospect_id: payload.prospect_id || null,
        requirement_id: payload.requirement_id || null,
        application_id: payload.application_id || null,
      },
    })

    if (insertError) {
      throw insertError
    }

    return json({ success: true }, corsHeaders)
  } catch (error) {
    console.error('log-recruiter-export error:', error)
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
