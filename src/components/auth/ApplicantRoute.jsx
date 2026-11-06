import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ApplicantRoute({ children }) {
  const { user, loading, userType, authorizationLoading } = useAuth()

  if (loading || (user && authorizationLoading && !userType)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-fg-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/applicant/login" replace />
  }

  if (userType !== 'applicant') {
    if (userType === 'recruiter') {
      return <Navigate to="/recruiter/dashboard" replace />
    }
    return <Navigate to="/applicant/login" replace />
  }

  return children
}
