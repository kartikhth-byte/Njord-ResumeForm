/* global process */
// Vercel Routing Middleware: forwards /ai/* to the Needle service named by
// this environment's NEEDLE_ORIGIN (docs/needle-in-holmes-design.md 4.1).
//
// Production sets NEEDLE_ORIGIN to production Needle, staging to a staging
// Needle. Where it is unset (preview deployments by default) /ai answers 404,
// so a preview never talks to any Needle and AI search shows "unavailable".
//
// Needle receives the path unchanged (/ai/...) and strips the prefix itself.
import { rewrite } from '@vercel/functions'

export const config = {
  matcher: ['/ai', '/ai/:path*'],
}

export function needleOrigin(raw) {
  const value = String(raw || '').trim().replace(/\/+$/, '')
  if (!value) return null
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  // Only a bare https origin: no path, query, credentials or plain http.
  if (url.protocol !== 'https:' || url.username || url.password) return null
  if (url.pathname !== '/' || url.search || url.hash) return null
  return url.origin
}

export function needleTarget(requestUrl, origin) {
  const incoming = new URL(requestUrl)
  const path = incoming.pathname === '/ai' ? '/ai/' : incoming.pathname
  if (path !== '/ai/' && !path.startsWith('/ai/')) return null
  return new URL(`${path}${incoming.search}`, origin)
}

export default function middleware(request) {
  const origin = process.env.VERCEL_ENV === 'preview' ? null : needleOrigin(process.env.NEEDLE_ORIGIN)
  const target = origin ? needleTarget(request.url, origin) : null
  if (!target) {
    return new Response(JSON.stringify({ success: false, error: 'AI search is not available here' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  return rewrite(target)
}
