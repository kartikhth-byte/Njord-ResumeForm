import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '../../lib/supabase'

export default function RecruiterRoute({ children }) {
  const { user, loading } = useAuth()
  const [userType, setUserType] = useState(null)
  const [checkingType, setCheckingType] = useState(true)

  useEffect(() => {
    const checkUserType = async () => {
      if (!user) {
        setCheckingType(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setUserType(data?.user_type)
      } catch (error) {
        console.error('Error checking user type:', error)
      } finally {
        setCheckingType(false)
      }
    }

    checkUserType()
  }, [user])

  // Still loading auth or user type
  if (loading || checkingType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - redirect to recruiter login
  if (!user) {
    return <Navigate to="/recruiter/login" replace />
  }

  // Wrong user type - show unauthorized
if (userType !== 'recruiter') {
  // Auto-redirect applicants to their dashboard
  if (userType === 'applicant') {
    return <Navigate to="/dashboard" replace />
  }
  // Unknown user type - sign out and go to login
  return <Navigate to="/login" replace />
}

  // Correct user type - render the route
  return children
}