import { useState, useEffect } from 'react'  // ✅ Added useEffect
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/auth/AuthContext'
import { Shield, Mail, Lock, AlertCircle, Users, CalendarCheck, Search } from 'lucide-react'

const signOutSafely = async () => {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error && error.name !== 'AuthSessionMissingError') {
    throw error
  }
}

export default function RecruiterLogin() {
  const navigate = useNavigate()
  const { user, userType, loading: authLoading, authorizationLoading, signOut } = useAuth()
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
          await signOut()
        }
      } catch (sessionError) {
        console.error('Session check error:', sessionError)
      } finally {
        setCheckingSession(false)
      }
    }

    checkExistingSession()
  }, [authLoading, authorizationLoading, user, userType, navigate, signOut])

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
        throw new Error('This account is not a recruiter account. Please use the applicant login.')
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
      setError('Enter your recruiter email first, then use Forgot password.')
      return
    }

    setResetLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/recruiter/reset-password`,
      })

      if (resetError) throw resetError

      setResetMessage('Password reset instructions have been sent to your recruiter email.')
    } catch (resetError) {
      console.error('Recruiter password reset request error:', resetError)
      setError(resetError.message || 'Unable to send password reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="public-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900"></div>
          <p className="text-slate-600">Checking session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-shell public-auth-shell">
      <div className="public-auth-grid">
        <section className="public-hero-card">
          <div className="public-eyebrow text-emerald-100">Recruiter Operations</div>
          <h1 className="public-title">A cleaner workspace for maritime hiring teams.</h1>
          <p className="public-copy">
            Sign in to review applications, run AI-powered sourcing, coordinate interviews, and manage status decisions.
          </p>

          <div className="public-feature-list">
            <div className="public-feature-item">
              <div className="public-feature-item__icon">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <p className="public-feature-item__title">Search and shortlist</p>
                <p className="public-feature-item__copy">
                  Use advanced search and recruiter filters to surface the right candidates faster.
                </p>
              </div>
            </div>
            <div className="public-feature-item">
              <div className="public-feature-item__icon">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="public-feature-item__title">Coordinate decisions</p>
                <p className="public-feature-item__copy">
                  Schedule tests, interviews, and offers from one connected recruiter workspace.
                </p>
              </div>
            </div>
            <div className="public-feature-item">
              <div className="public-feature-item__icon">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="public-feature-item__title">Shared team access</p>
                <p className="public-feature-item__copy">
                  Team seats, roles, and review actions stay coordinated across the recruiter dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="public-card">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="public-form-title mt-6">Recruiter sign in</h2>
          <p className="public-form-copy">
            Use your assigned recruiter credentials to access the hiring workspace.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="recruiter@njordships.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="Enter your password"
                />
              </div>
              <div className="mt-3 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetLoading ? 'Sending reset email...' : 'Forgot password?'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Login Failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {resetMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">Reset email sent</p>
                  <p className="mt-1 text-sm text-emerald-800">{resetMessage}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
              Not a recruiter? <Link to="/login" className="public-inline-link">Applicant Login</Link>
            </p>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            For security reasons, only authorized recruitment staff can access this portal.
          </p>
        </section>
      </div>
    </div>
  )
}
