// needle-token: a short-lived Ed25519 token that signs the current Holmes
// user in to Needle (AI search). Holmes posts it once to /ai/auth/holmes.
// Design: docs/needle-in-holmes-design.md section 4.2.
//
// Secrets:
//   NEEDLE_TOKEN_PRIVATE_KEY  Ed25519 private key, PKCS#8 PEM (\n escapes allowed)
//   NEEDLE_AI_SEARCH_ACCESS   off (default) | operator | on
//   NEEDLE_ORG_ID             optional; defaults to the seeded organization id
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { signNeedleToken } from '../_shared/needle-signing.ts'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { needleCallerAccess } from '../_shared/needle-access.js'
import { createNeedleTokenHandler } from './handler.js'

serve(createNeedleTokenHandler({
  getCorsHeaders, createAdminSupabaseClient, needleCallerAccess, signNeedleToken,
  env: (name: string) => Deno.env.get(name),
}))
