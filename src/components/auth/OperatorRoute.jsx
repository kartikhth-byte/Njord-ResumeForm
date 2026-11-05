import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

// Operator console access: the platform_operators flag, not a role.
export default function OperatorRoute({ children }) {
  const { user, loading, authorizationLoading, isOperator } = useAuth()

  if (loading || (user && authorizationLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-700" aria-label="Loading" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/recruiter/login" replace />
  }

  if (!isOperator) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
