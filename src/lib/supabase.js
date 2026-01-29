import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,        // ✅ Auto-refresh before expiry
    persistSession: true,          // ✅ Persist across page reloads
    detectSessionInUrl: false,     // ✅ Don't parse URL for session
    storage: window.localStorage,  // ✅ Use localStorage
    storageKey: 'njord-auth-token', // ✅ Custom key
    flowType: 'pkce'              // ✅ More secure auth flow
  }
})