// Needle (the AI search engine) inside Holmes.
// Design: docs/needle-in-holmes-design.md sections 4.1-4.2.
//
// Needle is served under Holmes's own address: vercel.json forwards
// /ai/* to the Needle service, so the frame is same-origin and Needle's
// session cookie works. Holmes signs the user in by asking its
// `needle-token` edge function for a short-lived token and posting it
// once to /ai/auth/holmes.

import { supabase } from './supabase'
import { createNeedleConnection } from './needleConnection'
import { resumeIntakeEnabled } from './resumeIntake'

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
  const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  return `${NEEDLE_BASE}/?embed=holmes&session=wait&theme=${theme}&intake=${resumeIntakeEnabled() ? 'enabled' : 'disabled'}#${path}`
}

// Exchange the Holmes session for a Needle session. Resolves to
// { ok: true } or { ok: false, reason }.
async function exchangeNeedleSession() {
  try {
    const signal = AbortSignal.timeout(15_000)
    const { data, error } = await supabase.functions.invoke('needle-token', { body: {}, signal })
    if (error || !data?.token) {
      return { ok: false, reason: 'token' }
    }
    const response = await fetch(`${NEEDLE_BASE}/auth/holmes`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.token }),
      signal,
    })
    if (!response.ok) return { ok: false, reason: `needle_${response.status}` }
    // The embedded AuthGate checks /auth/me before mounting any protected
    // screen. A missing cookie triggers the bounded parent recovery flow.
    // Checking here too added one serial round trip to every opening.
    markSession(true)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

// Best-effort sign-out of the Needle session (on Holmes sign-out).
async function logoutNeedleSession() {
  if (!sessionMarked()) return
  markSession(false)
  try {
    await fetch(`${NEEDLE_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {})
  } catch {
    // Ignore: the Needle session also expires on its own.
  }
}

const connection = createNeedleConnection({ exchange: exchangeNeedleSession, logout: logoutNeedleSession })
export const startNeedleSession = identity => connection.start(identity)
export const endNeedleSession = () => connection.end()
