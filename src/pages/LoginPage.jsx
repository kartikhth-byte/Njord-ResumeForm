import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { Ship, Briefcase, ShieldCheck, FileText } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { user, userType, loading, authorizationLoading, signInWithGoogle } = useAuth()
  const [checkingSession, setCheckingSession] = useState(true)

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

  const handleGoogleLogin = async () => {
    try {
      window.sessionStorage.setItem('njord-login-intent', 'applicant')
      await signInWithGoogle()
    } catch (error) {
      console.error('Error logging in with Google:', error)
      alert('Failed to login with Google')
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
            Sign in with Google to complete, update, and track your seafarer profile from one place.
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
                  Your application history and documents stay tied to your Google account for easy return access.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="public-card">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Ship className="h-7 w-7" />
          </div>
          <h2 className="public-form-title mt-6">Applicant login</h2>
          <p className="public-form-copy">
            Sign in to manage your maritime job applications, complete your profile, and track status updates.
          </p>

          <button
            onClick={handleGoogleLogin}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> Use your Google account to sign in. Your application data stays available any time you return.
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

          <p className="mt-8 text-sm text-slate-500">
            New to Njordships? Sign in with Google to create your account automatically.
          </p>
        </section>
      </div>
    </div>
  )
}
