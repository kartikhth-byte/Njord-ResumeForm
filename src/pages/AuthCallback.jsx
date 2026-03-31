import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { user, userType, loading, authorizationLoading } = useAuth()
  const [authResolutionTimedOut, setAuthResolutionTimedOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    const waitForSessionResolution = async () => {
      if (loading || user) return

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
  }, [loading, user])

  useEffect(() => {
    if (loading || (user && authorizationLoading && !userType)) return

    if (!user) {
      if (!authResolutionTimedOut) return
      navigate('/login', { replace: true })
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

    navigate('/login', { replace: true })
  }, [user, userType, loading, authorizationLoading, navigate, authResolutionTimedOut])

  return (
    <div className="public-shell flex min-h-screen items-center justify-center px-4">
      <div className="public-card max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] text-slate-900">
          Completing sign in
        </h1>
        <p className="mt-3 text-slate-600">
          We’re confirming your account and routing you to the right dashboard.
        </p>
      </div>
    </div>
  )
}
