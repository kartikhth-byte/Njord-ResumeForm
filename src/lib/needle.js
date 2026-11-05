// Needle (the AI search engine) inside Holmes.
// Design: docs/needle-in-holmes-design.md sections 4.1-4.2.
//
// Needle is served under Holmes's own address: vercel.json forwards
// /ai/* to the Needle service, so the frame is same-origin and Needle's
// session cookie works. Holmes signs the user in by asking its
// `needle-token` edge function for a short-lived token and posting it
// once to /ai/auth/holmes.

import { supabase } from './supabase'

export const NEEDLE_BASE = '/ai'
// Remembers (per browser) that a Needle session was opened, so sign-out only
// calls Needle when there is something to end.
const SESSION_MARK = 'holmes.needle.session'

function markSession(open) {
  try {
    if (open) window.localStorage.setItem(SESSION_MARK, '1')
    else window.localStorage.removeItem(SESSION_MARK)
  } catch {
    // Storage unavailable: sign-out just always calls Needle.
  }
}

function sessionMarked() {
  try {
    return window.localStorage.getItem(SESSION_MARK) === '1'
  } catch {
    return true
  }
}

// VITE_FEATURE_AI_SEARCH: "off" (default), "operator" (operators only),
// "on" (operators, Master Recruiters and Recruiters). Coordinators never.
// The needle-token function enforces the same rule server-side.
const ACCESS = String(import.meta.env.VITE_FEATURE_AI_SEARCH || 'off').trim().toLowerCase()

export function canUseAiSearch({ isOperator, role }) {
  if (ACCESS === 'operator') return Boolean(isOperator)
  if (ACCESS === 'on') return Boolean(isOperator) || role === 'Master Recruiter' || role === 'Recruiter'
  return false
}

export function aiSearchEnabled() {
  return ACCESS === 'operator' || ACCESS === 'on'
}

// The address of the embedded Needle UI for a Needle hash route
// ("/search", "/search/<project>/<chat>", "/repository").
export function needleFrameUrl(needlePath = '/search') {
  const path = needlePath.startsWith('/') ? needlePath : `/${needlePath}`
  return `${NEEDLE_BASE}/?embed=holmes#${path}`
}

// Exchange the Holmes session for a Needle session. Resolves to
// { ok: true } or { ok: false, reason }.
export async function startNeedleSession() {
  const { data, error } = await supabase.functions.invoke('needle-token', { body: {} })
  if (error || !data?.token) {
    return { ok: false, reason: 'token' }
  }
  try {
    const response = await fetch(`${NEEDLE_BASE}/auth/holmes`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.token }),
    })
    if (!response.ok) return { ok: false, reason: `needle_${response.status}` }
    // Confirm the Needle cookie actually stuck (it can be dropped by the
    // forwarding rule or a wrong cookie path); otherwise the frame would sit
    // on its sign-in screen forever.
    const me = await fetch(`${NEEDLE_BASE}/auth/me`, { credentials: 'same-origin' })
    const body = me.ok ? await me.json().catch(() => null) : null
    if (!body?.authenticated) return { ok: false, reason: 'session' }
    markSession(true)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

// Best-effort sign-out of the Needle session (on Holmes sign-out).
export function endNeedleSession() {
  if (!sessionMarked()) return
  markSession(false)
  try {
    fetch(`${NEEDLE_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Ignore: the Needle session also expires on its own.
  }
}
