import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, Lock, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/auth/AuthContext'

export default function RecruiterResetPassword() {
  const navigate = useNavigate()
  const { user, userType, loading, authorizationLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading || (user && authorizationLoading && !userType)) return

    if (!user) {
      setReady(true)
      return
    }

    if (userType && userType !== 'recruiter') {
      navigate('/unauthorized', { replace: true })
      return
    }

    setReady(true)
  }, [loading, authorizationLoading, user, userType, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('This reset link is no longer valid. Please request a fresh password reset email.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) throw updateError

      setSuccess(true)
      window.setTimeout(() => {
        navigate('/recruiter/dashboard', { replace: true })
      }, 2000)
    } catch (updateError) {
      console.error('Recruiter password reset error:', updateError)
      setError(updateError.message || 'Failed to update password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) {
    return (
      <div className="public-shell flex min-h-screen items-center justify-center px-4">
        <div className="public-card max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-soft text-success">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-fg">Preparing password reset</h1>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="public-shell flex min-h-screen items-center justify-center px-4">
        <div className="public-card max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-fg">Password updated</h1>
          <p className="mt-3 text-fg-secondary">Password changed. Redirecting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-shell public-auth-shell">
      <div className="public-auth-grid">
        <section className="public-hero-card">
          <h1 className="public-title">Set a new password for your recruiter account.</h1>
        </section>

        <section className="public-card">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-card bg-success-soft text-success">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="public-form-title mt-6">Reset recruiter password</h2>

          {!user ? (
            <div className="mt-8 rounded-card border border-danger-line bg-danger-soft p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-medium text-danger">Recovery link invalid</p>
                  <p className="mt-1 text-sm text-danger">
                    This link has expired or was already used. Request a new one from sign in.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-fg-secondary">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-fg-muted" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-card border border-line py-3 pl-10 pr-4 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30"
                    placeholder="Enter a new password"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-fg-secondary">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-fg-muted" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-card border border-line py-3 pl-10 pr-4 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30"
                    placeholder="Confirm your new password"
                  />
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-3 rounded-card border border-danger-line bg-danger-soft p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
                  <div>
                    <p className="text-sm font-medium text-danger">Unable to update password</p>
                    <p className="mt-1 text-sm text-danger">{error}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-card bg-accent-fill py-3 font-semibold text-on-accent transition hover:bg-accent-fill-hover disabled:cursor-not-allowed disabled:bg-line-strong"
              >
                {submitting ? 'Updating password...' : 'Update Password'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-line pt-6 text-center">
            <p className="text-sm text-fg-secondary">
              Back to{' '}
              <Link to="/recruiter/login" className="public-inline-link">
                Recruiter Login
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
