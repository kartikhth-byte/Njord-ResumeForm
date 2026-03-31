import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SETTING_ENV_FALLBACKS: Record<string, string[]> = {
  APP_URL: ['APP_URL', 'VITE_APP_URL'],
  WORKSHEET_SERVICE_URL: ['WORKSHEET_SERVICE_URL', 'VITE_WORKSHEET_SERVICE_URL'],
  EMAIL_FROM: ['EMAIL_FROM'],
  RECRUITER_NOTIFICATION_EMAIL: ['RECRUITER_NOTIFICATION_EMAIL'],
  RESEND_API_KEY: ['RESEND_API_KEY'],
  GEMINI_API_KEY: ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY'],
  MICROSOFT_CLIENT_ID: ['MICROSOFT_CLIENT_ID', 'VITE_MICROSOFT_CLIENT_ID'],
  MICROSOFT_TENANT_ID: ['MICROSOFT_TENANT_ID', 'VITE_MICROSOFT_TENANT_ID'],
  MICROSOFT_REDIRECT_URI: ['MICROSOFT_REDIRECT_URI', 'VITE_MICROSOFT_REDIRECT_URI'],
  MICROSOFT_CLIENT_SECRET: ['MICROSOFT_CLIENT_SECRET'],
}

export function createAdminSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
}

function getEnvFallback(settingKey: string) {
  const envKeys = SETTING_ENV_FALLBACKS[settingKey] || []

  for (const envKey of envKeys) {
    const value = Deno.env.get(envKey)
    if (value) return value
  }

  return ''
}

export async function getRuntimeSettings(
  settingKeys: string[],
  supabaseClient = createAdminSupabaseClient()
) {
  const uniqueKeys = Array.from(new Set(settingKeys))

  const { data, error } = await supabaseClient
    .from('runtime_settings')
    .select('setting_key, setting_value')
    .in('setting_key', uniqueKeys)

  if (error) {
    throw error
  }

  const stored = new Map((data || []).map((row) => [row.setting_key, row.setting_value]))

  return uniqueKeys.reduce<Record<string, string>>((accumulator, key) => {
    accumulator[key] = stored.get(key) || getEnvFallback(key)
    return accumulator
  }, {})
}
