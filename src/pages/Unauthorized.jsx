import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { AlertCircle, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    const getUserType = async () => {
      if (!user) return

      try {
        const { data } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single()

        setUserType(data?.user_type)
      } catch (error) {
        console.error('Error getting user type:', error)
      }
    }

    getUserType()
  }, [user])

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-100 rounded-full">
              <AlertCircle className="w-16 h-16 text-red-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>

          <p className="text-gray-600 mb-2">
            You don't have permission to access this page.
          </p>

          {userType && (
            <p className="text-sm text-gray-500 mb-6">
              You're logged in as a <span className="font-semibold">{userType}</span>.
              {userType === 'recruiter' && ' This page is only for applicants.'}
              {userType === 'applicant' && ' This page is only for recruiters.'}
            </p>
          )}

          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  )
}