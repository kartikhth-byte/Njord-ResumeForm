import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        console.log('Hash params:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken
        })

        if (!accessToken || !refreshToken) {
          throw new Error('Missing tokens in callback URL')
        }

        // Manually set the session with the tokens
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (setSessionError) {
          console.error('Set session error:', setSessionError)
          throw setSessionError
        }

        console.log('Session set successfully:', {
          user: data.user?.email,
          hasSession: !!data.session
        })

        // Small delay to ensure session is propagated
        await new Promise(resolve => setTimeout(resolve, 500))

        // Navigate to dashboard
        navigate('/dashboard', { replace: true })

      } catch (err) {
        console.error('Callback error:', err)
        setError(err.message)
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Completing sign in...</p>
        <p className="text-gray-500 text-sm mt-2">Please wait</p>
      </div>
    </div>
  )
}