import { createClient } from '@supabase/supabase-js'
import { supabaseApiKey } from './supabaseKey'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = supabaseApiKey

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'njord-auth-token',
    flowType: 'pkce',
    // Avoid cross-tab LockManager contention delaying getSession() on startup.
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  }
})
