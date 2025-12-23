import { useAuth } from '../auth/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'

export default function ProtectedAction({ 
  permission, 
  children, 
  fallback = null 
}) {
  const { user } = useAuth()
  const { hasPermission, loading } = usePermissions(user)

  if (loading) return null

  if (!hasPermission(permission)) {
    return fallback
  }

  return children
}