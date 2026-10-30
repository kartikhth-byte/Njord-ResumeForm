import { useState, useEffect } from 'react'  // ✅ Added useEffect
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/auth/AuthContext'
import AuthLayout, { AuthLoading, authButtonClass, authInputClass, authLabelClass } from '../components/auth/AuthLayout'

const signOutSafely = async () => {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error && error.name !== 'AuthSessionMissingError') {
    throw error
  }
}

export default function RecruiterLogin() {
  const navigate = useNavigate()
  const { user, userType, loading: authLoading, authorizationLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resetMessage, setResetMessage] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const checkExistingSession = async () => {
      if (authLoading || (user && authorizationLoading && !userType)) return

      try {
        if (userType === 'recruiter' && user) {
          navigate('/recruiter/dashboard', { replace: true })
          return
        }

        if (userType === 'applicant' && user) {
          navigate('/dashboard', { replace: true })
          return
        }
      } catch (sessionError) {
        console.error('Session check error:', sessionError)
      } finally {
        setCheckingSession(false)
      }
    }

    checkExistingSession()
  }, [authLoading, authorizationLoading, user, userType, navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Sign in with email and password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      // Check if user is a recruiter
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', authData.user.id)
        .single()

      if (profileError) {
        await signOutSafely()
        throw new Error('Profile not found')
      }

      if (profile.user_type !== 'recruiter') {
        await signOutSafely()
        throw new Error('This isn’t a recruiter account.')
      }

      // Success - navigate to recruiter dashboard
      navigate('/recruiter/dashboard', { replace: true })
    } catch (error) {
      console.error('Login error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setResetMessage(null)

    if (!email.trim()) {
      setError('Enter your email first.')
      return
    }

    setResetLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/recruiter/reset-password`,
      })

      if (resetError) throw resetError

      setResetMessage('Reset link sent. Check your email.')
    } catch (resetError) {
      console.error('Recruiter password reset request error:', resetError)
      setError(resetError.message || 'Unable to send password reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  if (checkingSession) {
    return <AuthLoading />
  }

  return (
    <AuthLayout title="Recruiter sign in">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="recruiter-email" className={authLabelClass}>Email</label>
          <input
            id="recruiter-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="recruiter-password" className="text-sm font-medium text-fg-secondary">Password</label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-sm text-accent-text hover:underline disabled:opacity-50"
            >
              {resetLoading ? 'Sending…' : 'Forgot?'}
            </button>
          </div>
          <input
            id="recruiter-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {resetMessage && <p className="text-sm text-success">{resetMessage}</p>}

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}
