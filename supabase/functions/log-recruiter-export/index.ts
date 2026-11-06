import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createExportLogHandler } from './handler.ts'

// Gateway JWT verification is disabled for modern Supabase signing keys.
// The handler independently verifies the user JWT and export permissions.
serve(createExportLogHandler({ createAdminSupabaseClient, getCorsHeaders }))
