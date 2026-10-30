import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { AlertCircle, Home } from 'lucide-react'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { userType } = useAuth()

  const handleGoHome = () => {
    if (userType === 'recruiter') {
      navigate('/recruiter/dashboard')
    } else if (userType === 'applicant') {
      navigate('/dashboard')
    } else {
      navigate('/applicant/login')
    }
  }

  return (
    <div className="public-shell flex min-h-screen items-center justify-center px-4">
      <div className="public-card max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertCircle className="h-10 w-10" />
        </div>

        <p className="mt-6 text-xs font-semibold text-danger">
          Permission Required
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-fg">
          Access Denied
        </h1>

        <p className="mx-auto mt-4 max-w-md text-fg-secondary">
          You don’t have access to this page.
        </p>

        {userType && (
          <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
            You're logged in as a <span className="font-semibold">{userType}</span>.
            {userType === 'recruiter' && ' This page is only for applicants.'}
            {userType === 'applicant' && ' This page is only for recruiters.'}
          </p>
        )}

        <button
          onClick={handleGoHome}
          className="mx-auto mt-8 inline-flex items-center gap-2 rounded-control bg-accent-fill px-6 py-3 font-semibold text-on-accent transition hover:bg-accent-fill-hover"
        >
          <Home className="h-5 w-5" />
          Go to Dashboard
        </button>

        <p className="mt-6 text-sm text-fg-muted">
          If you believe this is an error, contact support.
        </p>
      </div>
    </div>
  )
}
