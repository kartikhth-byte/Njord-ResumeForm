import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout, { AuthLoading, authButtonClass, authInputClass, authLabelClass } from '../components/auth/AuthLayout'
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
      setError('This link is no longer valid. Request a new one from sign in.')
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
    return <AuthLoading />
  }

  if (success) {
    return (
      <AuthLayout title="Password updated">
        <p className="text-sm text-fg-secondary">Redirecting…</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset password"
      footer={
        <Link to="/recruiter/login" className="text-accent-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      {!user ? (
        <p role="alert" className="text-sm text-danger">
          This link has expired or was already used. Request a new one from sign in.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className={authLabelClass}>New password</label>
            <input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className={authLabelClass}>Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={authInputClass}
            />
          </div>

          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

          <button type="submit" disabled={submitting} className={authButtonClass}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
