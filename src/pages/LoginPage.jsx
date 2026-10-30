import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'
import AuthLayout, { AuthLoading, authButtonClass, authInputClass, authLabelClass } from '../components/auth/AuthLayout'

export default function Login() {
  const navigate = useNavigate()
  const { user, userType, loading, authorizationLoading } = useAuth()
  const [checkingSession, setCheckingSession] = useState(true)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [linkRequested, setLinkRequested] = useState(false)
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    if (loading || (user && authorizationLoading && !userType)) return

    if (user) {
      if (userType === 'recruiter') {
        navigate('/recruiter/dashboard', { replace: true })
        return
      }

      if (userType === 'applicant') {
        navigate('/dashboard', { replace: true })
        return
      }
    }

    setCheckingSession(false)
  }, [user, userType, loading, authorizationLoading, navigate])

  const handleMagicLinkRequest = async (event) => {
    event.preventDefault()
    if (submitting) return

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setRequestError('Enter a valid email.')
      return
    }

    setSubmitting(true)
    setRequestError('')
    try {
      const { error } = await supabase.functions.invoke('request-applicant-magic-link', {
        body: { email: normalizedEmail },
      })
      if (error) throw error
      setLinkRequested(true)
    } catch (invokeError) {
      console.error('Magic link request failed:', invokeError)
      setRequestError('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return <AuthLoading />
  }

  return (
    <AuthLayout
      title={linkRequested ? 'Check your inbox' : 'Sign in'}
      subtitle={linkRequested ? null : 'Use the email our team contacted you on. We’ll send you a sign-in link.'}
      footer={
        <>
          Recruiter?{' '}
          <Link to="/recruiter/login" className="text-accent-text hover:underline">
            Sign in here
          </Link>
        </>
      }
    >
      {linkRequested ? (
        <div className="space-y-4">
          <p className="text-sm text-fg-secondary">
            If <span className="font-medium text-fg">{email.trim().toLowerCase()}</span> is registered, a
            sign-in link is on its way. Open it on this device.
          </p>
          <button
            type="button"
            onClick={() => setLinkRequested(false)}
            className="text-sm text-accent-text hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleMagicLinkRequest} className="space-y-4">
          <div>
            <label htmlFor="applicant-email" className={authLabelClass}>Email</label>
            <input
              id="applicant-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className={authInputClass}
            />
          </div>

          {requestError ? <p role="alert" className="text-sm text-danger">{requestError}</p> : null}

          <button type="submit" disabled={submitting} className={authButtonClass}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
