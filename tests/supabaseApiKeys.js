/* global process */
import { createClient } from '@supabase/supabase-js'

export function getPublicApiKey() {
  return process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
}

export function getAdminApiKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function createAdminClient(url) {
  const key = getAdminApiKey()
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
  }

  if (key?.startsWith('sb_secret_')) {
    options.global = {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
        if (headers.get('authorization') === `Bearer ${key}`) headers.delete('authorization')
        headers.set('apikey', key)
        return fetch(input, { ...init, headers })
      },
    }
  }

  return createClient(url, key, options)
}
