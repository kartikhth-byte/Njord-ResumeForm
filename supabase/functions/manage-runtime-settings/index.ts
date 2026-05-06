import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient, getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const SETTING_DEFINITIONS = [
  {
    key: 'MICROSOFT_CLIENT_ID',
    label: 'Microsoft Client ID',
    section: 'microsoft',
    isSecret: false,
    clientVisible: true,
  },
  {
    key: 'MICROSOFT_TENANT_ID',
    label: 'Microsoft Tenant ID',
    section: 'microsoft',
    isSecret: false,
    clientVisible: false,
  },
  {
    key: 'MICROSOFT_REDIRECT_URI',
    label: 'Microsoft Redirect URI',
    section: 'microsoft',
    isSecret: false,
    clientVisible: true,
  },
  {
    key: 'MICROSOFT_CLIENT_SECRET',
    label: 'Microsoft Client Secret',
    section: 'microsoft',
    isSecret: true,
    clientVisible: false,
  },
  {
    key: 'RESEND_API_KEY',
    label: 'Resend API Key',
    section: 'email',
    isSecret: true,
    clientVisible: false,
  },
  {
    key: 'EMAIL_FROM',
    label: 'Email From',
    section: 'email',
    isSecret: false,
    clientVisible: false,
  },
  {
    key: 'GEMINI_API_KEY',
    label: 'Gemini API Key',
    section: 'ai',
    isSecret: true,
    clientVisible: false,
  },
  {
    key: 'APP_URL',
    label: 'App URL',
    section: 'app',
    isSecret: false,
    clientVisible: true,
  },
  {
    key: 'WORKSHEET_SERVICE_URL',
    label: 'Worksheet Service URL',
    section: 'app',
    isSecret: false,
    clientVisible: true,
  },
]

const SETTINGS_BY_KEY = new Map(SETTING_DEFINITIONS.map(setting => [setting.key, setting]))

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

    const body = await req.json()
    const action = body?.action

    if (action === 'get_client_config') {
      const clientKeys = SETTING_DEFINITIONS.filter(setting => setting.clientVisible).map(setting => setting.key)
      const values = await getRuntimeSettings(clientKeys, supabaseClient)
      return json({ settings: values }, corsHeaders)
    }

    const { data: canManageSettings, error: permError } = await supabaseClient.rpc('has_permission', {
      user_uuid: user.id,
      permission_name: 'manage_settings',
    })

    if (permError || canManageSettings !== true) {
      return json({ error: 'Insufficient permissions' }, corsHeaders, 403)
    }

    if (action === 'get_admin') {
      const values = await getRuntimeSettings(SETTING_DEFINITIONS.map(setting => setting.key), supabaseClient)

      const settings = SETTING_DEFINITIONS.map(setting => ({
        key: setting.key,
        label: setting.label,
        section: setting.section,
        isSecret: setting.isSecret,
        value: setting.isSecret ? '' : values[setting.key] || '',
        configured: Boolean(values[setting.key]),
      }))

      return json({ settings }, corsHeaders)
    }

    if (action === 'update_admin') {
      const incomingSettings = body?.settings || {}
      const updates = []

      for (const [key, rawValue] of Object.entries(incomingSettings)) {
        const definition = SETTINGS_BY_KEY.get(key)
        if (!definition) continue

        const value = typeof rawValue === 'string' ? rawValue.trim() : ''

        if (definition.isSecret && !value) continue
        if (!definition.isSecret && value === '') continue

        updates.push({
          setting_key: key,
          setting_value: value,
          is_secret: definition.isSecret,
          updated_by: user.id,
        })
      }

      if (updates.length === 0) {
        return json({ success: true, updated: 0 }, corsHeaders)
      }

      const { error: upsertError } = await supabaseClient
        .from('runtime_settings')
        .upsert(updates, { onConflict: 'setting_key' })

      if (upsertError) {
        throw upsertError
      }

      return json({ success: true, updated: updates.length }, corsHeaders)
    }

    return json({ error: 'Unsupported action' }, corsHeaders, 400)
  } catch (error) {
    console.error('manage-runtime-settings error:', error)
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
