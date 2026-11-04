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

        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-fg">
          No access
        </h1>

        <button
          onClick={handleGoHome}
          className="mx-auto mt-8 inline-flex items-center gap-2 rounded-control bg-accent-fill px-6 py-3 font-semibold text-on-accent transition hover:bg-accent-fill-hover"
        >
          {userType ? <Home className="h-5 w-5" /> : null}
          {userType ? 'Go to dashboard' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
