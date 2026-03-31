import { supabase } from '../lib/supabase'

let clientConfigPromise = null

export const SETTINGS_SECTIONS = {
  microsoft: 'Microsoft Integration',
  email: 'Email Delivery',
  ai: 'AI Services',
  app: 'App Configuration',
}

async function invokeManageRuntimeSettings(body) {
  const { data, error } = await supabase.functions.invoke('manage-runtime-settings', {
    body,
  })

  if (error) {
    throw error
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data
}

export async function getClientRuntimeSettings(forceRefresh = false) {
  if (!clientConfigPromise || forceRefresh) {
    clientConfigPromise = invokeManageRuntimeSettings({ action: 'get_client_config' }).then(
      ({ settings = {} }) => ({
        MICROSOFT_CLIENT_ID: settings.MICROSOFT_CLIENT_ID || import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
        MICROSOFT_REDIRECT_URI: settings.MICROSOFT_REDIRECT_URI || import.meta.env.VITE_MICROSOFT_REDIRECT_URI || '',
        APP_URL: settings.APP_URL || import.meta.env.VITE_APP_URL || '',
        WORKSHEET_SERVICE_URL: settings.WORKSHEET_SERVICE_URL || import.meta.env.VITE_WORKSHEET_SERVICE_URL || '',
      })
    )
  }

  return clientConfigPromise
}

export async function getAdminRuntimeSettings() {
  const { settings = [] } = await invokeManageRuntimeSettings({ action: 'get_admin' })
  return settings
}

export async function updateAdminRuntimeSettings(settings) {
  return invokeManageRuntimeSettings({
    action: 'update_admin',
    settings,
  })
}
