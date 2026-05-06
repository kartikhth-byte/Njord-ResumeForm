const DEFAULT_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type'
const DEFAULT_ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'

function parseAllowedOrigins(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getConfiguredAppUrlFallback() {
  return Deno.env.get('APP_URL') || Deno.env.get('VITE_APP_URL') || ''
}

async function getStoredAppUrl() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return ''
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/runtime_settings?setting_key=eq.APP_URL&select=setting_value`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  )

  if (!response.ok) {
    return ''
  }

  const rows = await response.json()
  return Array.isArray(rows) ? rows[0]?.setting_value || '' : ''
}

export async function getCorsHeaders(
  req: Request,
  options: {
    allowHeaders?: string
    allowMethods?: string
    exposeHeaders?: string
  } = {},
) {
  const origin = req.headers.get('origin')?.trim() || ''

  let configuredAppUrl = getConfiguredAppUrlFallback()

  try {
    configuredAppUrl = await getStoredAppUrl() || configuredAppUrl
  } catch (_error) {
    // Fall back to environment configuration when runtime settings are unavailable.
  }

  const allowedOrigins = parseAllowedOrigins(configuredAppUrl)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': options.allowHeaders || DEFAULT_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': options.allowMethods || DEFAULT_ALLOW_METHODS,
    Vary: 'Origin',
  }

  if (options.exposeHeaders) {
    headers['Access-Control-Expose-Headers'] = options.exposeHeaders
  }

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}
