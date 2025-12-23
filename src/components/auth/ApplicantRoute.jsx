import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '../../lib/supabase'

export default function ApplicantRoute({ children }) {
  const { user, loading } = useAuth()
  const [userType, setUserType] = useState(null)
  const [checkingType, setCheckingType] = useState(true)

  useEffect(() => {
    const checkUserType = async () => {
      console.log('=== ApplicantRoute Debug ===')
      console.log('User:', user)
      
      if (!user) {
        console.log('No user')
        setUserType(null)
        setCheckingType(false)
        return
      }

      try {
        console.log('Fetching profile for user ID:', user.id)
        
        const { data, error } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single()

        console.log('Profile data:', data)
        console.log('Profile error:', error)

        if (error) {
          console.error('Error fetching profile:', error)
          setUserType(null)
          setCheckingType(false)
          return
        }
        
        const fetchedUserType = data?.user_type
        console.log('Setting user type to:', fetchedUserType)
        
        // Set userType FIRST, then set checkingType to false
        setUserType(fetchedUserType)
        
        // Small delay to ensure state is set
        setTimeout(() => {
          setCheckingType(false)
          console.log('Check complete, userType should be:', fetchedUserType)
        }, 0)
        
      } catch (error) {
        console.error('Caught error:', error)
        setUserType(null)
        setCheckingType(false)
      }
    }

    if (!loading) {
      checkUserType()
    }
  }, [user, loading])

  console.log('=== RENDER ===')
  console.log('Current state - loading:', loading, 'checkingType:', checkingType, 'userType:', userType)

  // Still loading auth or user type
  if (loading || checkingType) {
    console.log('Showing loading screen')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - redirect to applicant login
  if (!user) {
    console.log('No user - redirecting to /login')
    return <Navigate to="/login" replace />
  }

  // Wrong user type - show unauthorized
  console.log('Final check - userType:', userType, 'Expected: applicant')
  if (userType !== 'applicant') {
    // Auto-redirect recruiters to their dashboard
    if (userType === 'recruiter') {
      return <Navigate to="/recruiter/dashboard" replace />
    }
    // Unknown user type - sign out and go to login
    return <Navigate to="/login" replace />
  }

  console.log('✅ ACCESS GRANTED!')
  // Correct user type - render the route
  return children
}