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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] text-slate-900">Preparing password reset</h1>
          <p className="mt-3 text-slate-600">We’re validating your recovery link and loading a secure password update session.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="public-shell flex min-h-screen items-center justify-center px-4">
        <div className="public-card max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] text-slate-900">Password updated</h1>
          <p className="mt-3 text-slate-600">Your recruiter password has been changed successfully. Redirecting you back to the recruiter workspace.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-shell public-auth-shell">
      <div className="public-auth-grid">
        <section className="public-hero-card">
          <div className="public-eyebrow text-emerald-100">Recruiter Security</div>
          <h1 className="public-title">Set a new password for your recruiter account.</h1>
          <p className="public-copy">
            Use a strong password that only your hiring team controls. Once saved, this password replaces the previous one immediately.
          </p>
        </section>

        <section className="public-card">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="public-form-title mt-6">Reset recruiter password</h2>
          <p className="public-form-copy">
            Enter your new password below to restore access to the recruiter workspace.
          </p>

          {!user ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Recovery link invalid</p>
                  <p className="mt-1 text-sm text-red-700">
                    This link may have expired or already been used. Request a fresh reset email from recruiter login.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    placeholder="Enter a new password"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    placeholder="Confirm your new password"
                  />
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Unable to update password</p>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? 'Updating password...' : 'Update Password'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
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
