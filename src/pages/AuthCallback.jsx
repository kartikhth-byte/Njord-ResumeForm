import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { user, userType, loading, authorizationLoading } = useAuth()
  const [authResolutionTimedOut, setAuthResolutionTimedOut] = useState(false)
  const [claimError, setClaimError] = useState(false)
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

    const redeem = async () => {
      window.sessionStorage.setItem('njord-login-intent', 'applicant')
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: params.get('type') || 'email',
      })
      if (error) throw error

      const bytes = new TextEncoder().encode(tokenHash)
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      const claimTokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      const { data: claim, error: claimFailure } = await supabase.rpc('claim_applicant_magic_link', {
        p_claim_token_hash: claimTokenHash,
      })
      if (claimFailure || !claim?.prospect_id) throw claimFailure || new Error('Invite claim was not accepted')
      try {
        window.sessionStorage.setItem('njord-applicant-prospect-id', claim.prospect_id)
        if (claim.case_id) window.sessionStorage.setItem('njord-applicant-case-id', claim.case_id)
        else window.sessionStorage.removeItem('njord-applicant-case-id')
      } catch {
        // The database claim succeeded; blocked session storage must not undo it.
      }
    }

    let redeemed = false
    redeem()
      .then(() => {
        redeemed = true
        // A previous recruiter session can leave stale role state in this tab.
        // Reload with the redeemed applicant session before route guards run.
        window.history.replaceState(null, '', window.location.pathname)
        window.location.replace('/dashboard')
      })
      .catch(async (error) => {
        console.error('Applicant link redemption failed:', error?.message)
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } finally {
          setClaimError(true)
        }
      })
      .finally(() => {
        if (redeemed) return
        params.delete('token_hash')
        params.delete('type')
        params.delete('login_intent')
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
    if (claimError || verifying || loading || (user && authorizationLoading && !userType)) return

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
  }, [user, userType, loading, authorizationLoading, navigate, authResolutionTimedOut, verifying, claimError])

  if (claimError) {
    return (
      <div className="public-shell flex min-h-screen items-center justify-center px-4">
        <div className="public-card max-w-md text-center">
          <h1 className="text-2xl font-semibold text-fg">Link unavailable</h1>
          <p className="mt-3 text-fg-secondary">This sign-in link could not be used. Ask your recruiter for a new invitation.</p>
        </div>
      </div>
    )
  }

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
