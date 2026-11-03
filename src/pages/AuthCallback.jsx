import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { user, userType, loading, authorizationLoading } = useAuth()
  const [authResolutionTimedOut, setAuthResolutionTimedOut] = useState(false)
  const [verifying, setVerifying] = useState(
    () => new URLSearchParams(window.location.search).has('token_hash')
  )
  const verifyStartedRef = useRef(false)

  // Applicant sign-in links carry a one-time token_hash (see request-applicant-magic-link).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    if (!tokenHash || verifyStartedRef.current) return
    verifyStartedRef.current = true

    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: params.get('type') || 'email' })
      .then(({ error }) => {
        if (error) console.error('Sign-in link could not be verified:', error.message)
      })
      .finally(() => {
        params.delete('token_hash')
        params.delete('type')
        const query = params.toString()
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
        setVerifying(false)
      })
  }, [])

  useEffect(() => {
    let cancelled = false

    const waitForSessionResolution = async () => {
      if (loading || user || verifying) return

      const timeoutAt = Date.now() + 4000

      while (!cancelled && Date.now() < timeoutAt) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          return
        }

        await new Promise(resolve => window.setTimeout(resolve, 150))
      }

      if (!cancelled) {
        setAuthResolutionTimedOut(true)
      }
    }

    waitForSessionResolution()

    return () => {
      cancelled = true
    }
  }, [loading, user, verifying])

  useEffect(() => {
    if (verifying || loading || (user && authorizationLoading && !userType)) return

    if (!user) {
      if (!authResolutionTimedOut) return
      navigate('/applicant/login', { replace: true })
      return
    }

    if (userType === 'recruiter') {
      navigate('/recruiter/dashboard', { replace: true })
      return
    }

    if (userType === 'applicant') {
      navigate('/dashboard', { replace: true })
      return
    }

    navigate('/applicant/login', { replace: true })
  }, [user, userType, loading, authorizationLoading, navigate, authResolutionTimedOut, verifying])

  return (
    <div className="public-shell flex min-h-screen items-center justify-center px-4">
      <div className="public-card max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-fg">
          Completing sign in
        </h1>
      </div>
    </div>
  )
}
