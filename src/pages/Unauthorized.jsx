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
      navigate('/login')
    }
  }

  return (
    <div className="public-shell flex min-h-screen items-center justify-center px-4">
      <div className="public-card max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-10 w-10" />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
          Permission Required
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-900">
          Access Denied
        </h1>

        <p className="mx-auto mt-4 max-w-md text-slate-600">
          You do not have permission to access this page with the current account context.
        </p>

        {userType && (
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
            You're logged in as a <span className="font-semibold">{userType}</span>.
            {userType === 'recruiter' && ' This page is only for applicants.'}
            {userType === 'applicant' && ' This page is only for recruiters.'}
          </p>
        )}

        <button
          onClick={handleGoHome}
          className="mx-auto mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          <Home className="h-5 w-5" />
          Go to Dashboard
        </button>

        <p className="mt-6 text-sm text-slate-500">
          If you believe this is an error, contact support.
        </p>
      </div>
    </div>
  )
}
