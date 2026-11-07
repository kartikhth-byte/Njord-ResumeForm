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

function needlePathFromHolmes(pathname) {
  const rest = pathname.startsWith(ROUTE_PREFIX) ? pathname.slice(ROUTE_PREFIX.length) : ''
  return rest && rest !== '/' ? rest : '/search'
}

export default function RecruiterAiSearch() {
  const { user, profile, role, isOperator, signOut, loading, authorizationLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const frameRef = useRef(null)
  const lastNeedlePathRef = useRef(needlePathFromHolmes(location.pathname))
  // Last re-sign-in triggered by the frame (not the first sign-in). A second
  // request within the window means the session is not sticking: stop.
  const lastResignInRef = useRef(0)
  const [status, setStatus] = useState('connecting') // connecting | ready | unavailable
  // Set each time the frame is (re)created, from the place the user was at.
  const [frameSrc, setFrameSrc] = useState('')
  const [selection, setSelection] = useState(null)
  const requirementId = new URLSearchParams(location.search).get('requirement')

  const allowed = canUseAiSearch({ isOperator, role })

  const signIn = useCallback(async () => {
    const result = await startNeedleSession()
    return result.ok
  }, [])

  // First sign-in, then show the frame.
  useEffect(() => {
    if (!allowed) return undefined
    let cancelled = false
    setStatus('connecting')
    signIn().then((ok) => {
      if (cancelled) return
      if (ok) setFrameSrc(needleFrameUrl(lastNeedlePathRef.current))
      setStatus(ok ? 'ready' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [allowed, signIn])

  const postToFrame = useCallback((message) => {
    const target = frameRef.current?.contentWindow
    if (target) target.postMessage(message, window.location.origin)
  }, [])

  // Messages from the Needle frame.
  useEffect(() => {
    if (status !== 'ready') return undefined
    const onMessage = async (event) => {
      if (event.origin !== window.location.origin) return
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return
      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'needle:route' && typeof data.path === 'string' && data.path.startsWith('/') && !data.path.startsWith('//')) {
        lastNeedlePathRef.current = data.path
        const next = `${ROUTE_PREFIX}${data.path}`
        // Replace: the frame's own hash changes already create history entries.
        if (next !== window.location.pathname) navigate(`${next}${location.search}`, { replace: true })
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
        if (Date.now() - lastResignInRef.current < RESIGN_IN_MIN_INTERVAL_MS) {
          setStatus('unavailable')
          return
        }
        lastResignInRef.current = Date.now()
        const ok = await signIn()
        if (ok) postToFrame({ type: 'holmes:signed-in' })
        else setStatus('unavailable')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [status, navigate, signIn, postToFrame, location.search])

  // Holmes-side navigation (Back/Forward, sidebar link) moves the frame.
  useEffect(() => {
    if (status !== 'ready') return
    const wanted = needlePathFromHolmes(location.pathname)
    if (wanted !== lastNeedlePathRef.current) {
      lastNeedlePathRef.current = wanted
      postToFrame({ type: 'holmes:navigate', path: wanted })
    }
  }, [location.pathname, status, postToFrame])

  if (loading || (user && authorizationLoading && status !== 'ready')) {
    return null
  }

  if (!user) return <Navigate to="/recruiter/login" replace />
  if (!allowed) return <Navigate to={isOperator ? "/operator" : "/unauthorized"} replace />

  const retry = async () => {
    setStatus('connecting')
    const ok = await signIn()
    if (ok) setFrameSrc(needleFrameUrl(lastNeedlePathRef.current))
    setStatus(ok ? 'ready' : 'unavailable')
  }

  return (
    <div className="recruiter-shell recruiter-ai-shell flex h-dvh min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
      {selection && <AddToHolmesDialog resumeIds={selection.ids} stageId={selection.stageId} requirementId={requirementId} onClose={() => { setSelection(null); frameRef.current?.focus() }} />}
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      {status === 'ready' && frameSrc ? (
        <iframe
          ref={frameRef}
          src={frameSrc}
          title="AI search"
          className="min-h-0 w-full flex-1 border-0 bg-transparent"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          {status === 'connecting' ? (
            <Loader2 className="h-6 w-6 animate-spin text-fg-muted" aria-label="Loading" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="text-sm text-fg-secondary">AI search is unavailable right now.</div>
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
