// Retired Holmes application-embedding search. Historical rows are retained.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
serve(async req => {
  const cors = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  return new Response(JSON.stringify({ error: 'Application embedding search is retired. Use AI search.' }), {
    status: 410, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
})
