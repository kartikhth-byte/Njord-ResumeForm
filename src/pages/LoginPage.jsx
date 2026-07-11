import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { Ship, Briefcase, ShieldCheck, FileText, Loader2, MailCheck } from 'lucide-react'

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
      setRequestError('Please enter a valid email address.')
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
      setRequestError('We could not process the request right now. Please try again in a moment.')
    } finally {
      setSubmitting(false)
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
          <div className="public-eyebrow text-blue-100">Njordships Careers</div>
          <h1 className="public-title">Maritime applications, handled with more confidence.</h1>
          <p className="public-copy">
            Access your seafarer application through the secure link sent to your email.
          </p>

          <div className="public-feature-list">
            <div className="public-feature-item">
              <div className="public-feature-item__icon">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="public-feature-item__title">One guided application</p>
                <p className="public-feature-item__copy">
                  Save progress automatically and return whenever you need to update documents or sea service.
                </p>
              </div>
            </div>
            <div className="public-feature-item">
              <div className="public-feature-item__icon">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="public-feature-item__title">Professional recruiter review</p>
                <p className="public-feature-item__copy">
                  Recruiters review qualifications, certificates, and availability directly from your submitted profile.
                </p>
              </div>
            </div>
            <div className="public-feature-item">
              <div className="public-feature-item__icon">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="public-feature-item__title">Secure account access</p>
                <p className="public-feature-item__copy">
                  No passwords to remember — every sign-in uses a fresh, single-use link sent to your registered email.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="public-card">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Ship className="h-7 w-7" />
          </div>
          <h2 className="public-form-title mt-6">Applicant access</h2>
          <p className="public-form-copy">
            Enter the email address our recruitment team contacted you on, and we will send you a secure
            sign-in link.
          </p>

          {linkRequested ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <MailCheck className="mt-0.5 h-5 w-5 flex-none text-emerald-700" />
                <div>
                  <p className="font-semibold text-emerald-900">Check your inbox</p>
                  <p className="mt-1 text-sm text-emerald-800">
                    If <strong>{email.trim().toLowerCase()}</strong> belongs to an approved candidate, a
                    sign-in link is on its way. The link is single-use — open it on this device.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLinkRequested(false)}
                    className="mt-3 text-sm font-medium text-emerald-900 underline underline-offset-2"
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkRequest} className="mt-8 space-y-4">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {requestError ? (
                <p className="text-sm text-rose-600">{requestError}</p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {submitting ? 'Sending link…' : 'Email me a sign-in link'}
              </button>
            </form>
          )}

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> Applicant access is by invitation. If you have not been contacted by
              our recruitment team yet, the sign-in link will not be issued.
            </p>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
              Are you a recruiter?{' '}
              <Link to="/recruiter/login" className="public-inline-link">
                Go to recruiter sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
