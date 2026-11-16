import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import AddToHolmesDialog from '../components/recruiter/AddToHolmesDialog'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../components/auth/AuthContext'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import { canUseAiSearch, needleFrameUrl, startNeedleSession } from '../lib/needle'
import { resumeIntakeEnabled } from '../lib/resumeIntake'

// AI search: Needle's own screens embedded under Holmes's address
// (docs/needle-in-holmes-design.md sections 4.1-4.2).
//
// Holmes address  /recruiter/ai/search/<project>/<chat>
// Needle address  /ai/?embed=holmes#/search/<project>/<chat>
//
// The frame is same-origin (Holmes forwards /ai/* to Needle), so messages
// are accepted only from that frame on this origin and posted only to it.
const ROUTE_PREFIX = '/recruiter/ai'
const RESIGN_IN_MIN_INTERVAL_MS = 30_000

function needlePathFromHolmes(pathname, search = '') {
  const rest = pathname.startsWith(ROUTE_PREFIX) ? pathname.slice(ROUTE_PREFIX.length) : ''
  return (rest && rest !== '/' ? rest : '/search') + (rest === '/review' ? search : '')
}

export default function RecruiterAiSearch({ reviewOnly = false }) {
  const { user, profile, role, isOperator, signOut, loading, authorizationLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const frameRef = useRef(null)
  const lastNeedlePathRef = useRef(needlePathFromHolmes(location.pathname, location.search))
  // Last re-sign-in triggered by the frame (not the first sign-in). A second
  // request within the window means the session is not sticking: stop.
  const lastResignInRef = useRef(0)
  const recoveryRef = useRef(null)
  const [status, setStatus] = useState('connecting') // connecting | ready | unavailable
  // Set each time the frame is (re)created, from the place the user was at.
  const [frameSrc, setFrameSrc] = useState('')
  const [frameIdentity, setFrameIdentity] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const sessionIdentity = user?.id ? `${user.id}:${role}:${Boolean(isOperator)}` : ''
  const identityRef = useRef(sessionIdentity)
  identityRef.current = sessionIdentity
  const [selection, setSelection] = useState(null)
  const requirementId = new URLSearchParams(location.search).get('requirement')

  const allowed = canUseAiSearch({ isOperator, role }) && (!reviewOnly || isOperator)

  const signIn = useCallback(async () => {
    const result = await startNeedleSession(sessionIdentity)
    return result.ok
  }, [sessionIdentity])

  // Download static UI alongside sign-in; Needle waits for our signed-in message.
  useEffect(() => {
    if (!allowed || !sessionIdentity) return undefined
    let cancelled = false
    setStatus('connecting')
    setConnectionId('')
    setFrameSrc(needleFrameUrl(lastNeedlePathRef.current))
    setFrameIdentity(sessionIdentity)
    lastResignInRef.current = 0
    recoveryRef.current = null
    signIn().then((ok) => {
      if (cancelled) return
      if (ok) setConnectionId(crypto.randomUUID())
      setStatus(ok ? 'ready' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [allowed, signIn, sessionIdentity])

  const postToFrame = useCallback((message) => {
    const target = frameRef.current?.contentWindow
    if (target) target.postMessage(message, window.location.origin)
  }, [])

  const postTheme = useCallback(() => postToFrame({ type: 'holmes:theme', theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark' }), [postToFrame])
  useEffect(() => {
    const observer = new MutationObserver(postTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [postTheme])

  const postSession = useCallback(() => {
    if (status === 'ready' && connectionId && frameIdentity === sessionIdentity)
      postToFrame({ type: 'holmes:signed-in', connection_id: connectionId })
  }, [status, connectionId, frameIdentity, sessionIdentity, postToFrame])
  useEffect(postSession, [postSession])

  // Messages from the Needle frame.
  useEffect(() => {
    if (status !== 'ready' || frameIdentity !== sessionIdentity) return undefined
    const onMessage = async (event) => {
      if (event.origin !== window.location.origin) return
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return
      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'needle:booted') { postSession(); return }
      if (data.type === 'needle:ready') {
        postTheme()
        postToFrame({ type: 'holmes:navigate', path: needlePathFromHolmes(location.pathname, location.search) })
        return
      }

      if (data.type === 'needle:route' && typeof data.path === 'string' && data.path.startsWith('/') && !data.path.startsWith('//')) {
        lastNeedlePathRef.current = data.path
        const suffix = data.path.split('?')[0] === '/review' || location.pathname === `${ROUTE_PREFIX}/review` ? '' : location.search
        const next = `${ROUTE_PREFIX}${data.path}${suffix}`
        // Replace: the frame's own hash changes already create history entries.
        if (next !== window.location.pathname + window.location.search) navigate(next, { replace: true })
        return
      }

      if (data.type === 'needle:add-to-holmes') {
        if (!resumeIntakeEnabled()) return
        const ids = data.resume_ids
        if (Array.isArray(ids) && ids.length > 0 && ids.length <= 25 && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id))) {
          setSelection({ ids, stageId: typeof data.stage_id === 'string' ? data.stage_id : null })
        }
        return
      }
      if (data.type === 'needle:auth-required') {
        // Several protected requests may fail together. They share the same
        // recovery; only a fresh failure AFTER it finishes consumes the limit.
        if (recoveryRef.current?.source === event.source && recoveryRef.current?.identity === sessionIdentity) return
        if (Date.now() - lastResignInRef.current < RESIGN_IN_MIN_INTERVAL_MS) {
          setStatus('unavailable')
          return
        }
        lastResignInRef.current = Date.now()
        const recovery = { source: event.source, identity: sessionIdentity }
        recoveryRef.current = recovery
        const ok = await signIn()
        if (recoveryRef.current === recovery) recoveryRef.current = null
        // URL changes keep this frame alive; only a different frame or
        // identity should invalidate an in-flight session recovery.
        if (frameRef.current?.contentWindow !== event.source || identityRef.current !== sessionIdentity) return
        if (ok) setConnectionId(crypto.randomUUID())
        else setStatus('unavailable')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [status, navigate, signIn, postToFrame, postTheme, postSession, frameIdentity, sessionIdentity, location.pathname, location.search])

  // Holmes-side navigation (Back/Forward, sidebar link) moves the frame.
  useEffect(() => {
    if (status !== 'ready') return
    const wanted = needlePathFromHolmes(location.pathname, location.search)
    if (wanted !== lastNeedlePathRef.current) {
      lastNeedlePathRef.current = wanted
      postToFrame({ type: 'holmes:navigate', path: wanted })
    }
  }, [location.pathname, location.search, status, postToFrame])

  if (loading || (user && authorizationLoading && status !== 'ready')) {
    return null
  }

  if (!user) return <Navigate to="/recruiter/login" replace />
  if (!allowed) return <Navigate to={isOperator ? "/operator" : "/unauthorized"} replace />

  const retry = async () => {
    setStatus('connecting')
    const retryIdentity = sessionIdentity
    const ok = await signIn()
    if (identityRef.current !== retryIdentity) return
    if (ok) { setConnectionId(crypto.randomUUID()); setFrameSrc(needleFrameUrl(lastNeedlePathRef.current)); setFrameIdentity(sessionIdentity) }
    setStatus(ok ? 'ready' : 'unavailable')
  }

  return (
    <div className="recruiter-shell recruiter-ai-shell flex h-dvh min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
      {selection && <AddToHolmesDialog resumeIds={selection.ids} stageId={selection.stageId} requirementId={requirementId} onClose={() => { setSelection(null); frameRef.current?.focus() }} />}
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      {status !== 'unavailable' && frameSrc && frameIdentity === sessionIdentity && (
        <iframe
          ref={frameRef}
          onLoad={() => { postTheme(); postSession() }}
          key={frameIdentity}
          src={frameSrc}
          title={reviewOnly ? "Résumé Review" : "AI search"}
          className={status === 'ready' ? "min-h-0 w-full flex-1 border-0 bg-transparent" : "absolute h-0 w-0 border-0 invisible"}
        />
      )}
      {status !== 'ready' && (
        <div className="flex flex-1 items-center justify-center p-6">
          {status === 'connecting' ? (
            <div role="status" className="flex items-center gap-3 text-sm text-fg-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Opening {reviewOnly ? 'Résumé Review' : 'AI Search'}…</div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="text-sm text-fg-secondary">{reviewOnly ? 'Résumé Review' : 'AI search'} is unavailable right now.</div>
              <button
                type="button"
                onClick={retry}
                className="btn-primary"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
