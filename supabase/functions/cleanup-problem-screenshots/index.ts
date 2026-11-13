import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { cleanupHandler } from './handler.js'
serve(cleanupHandler({ admin: createAdminSupabaseClient(), token: Deno.env.get('PROBLEM_SCREENSHOT_CLEANUP_TOKEN') }))
