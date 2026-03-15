/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function MicrosoftOAuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing') // 'processing', 'success', 'error'
  const [message, setMessage] = useState('Connecting to Microsoft Teams...')

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    // Get OAuth code from URL
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This is the user ID
    const error = searchParams.get('error')

    // Check for OAuth errors from Microsoft
    if (error) {
      console.error('❌ Microsoft OAuth error:', error)
      setStatus('error')
      setMessage(`Authentication failed: ${error}`)
      setTimeout(() => navigate('/recruiter/applications'), 3000)
      return
    }

    // Check if we have the authorization code
    if (!code) {
      console.error('❌ No authorization code received')
      setStatus('error')
      setMessage('No authorization code received from Microsoft')
      setTimeout(() => navigate('/recruiter/applications'), 3000)
      return
    }

    console.log('✅ Authorization code received, exchanging for tokens...')

    try {
      // Call edge function to exchange code for access token
      const { data, error: functionError } = await supabase.functions.invoke(
        'microsoft-oauth-callback',
        {
          body: {
            code: code,
            userId: state // Pass user ID from state
          }
        }
      )

      console.log('📧 Edge function response:', { data, error: functionError })

      if (functionError) {
        console.error('❌ Edge function error:', functionError)
        setStatus('error')
        setMessage(functionError.message || 'Failed to connect Microsoft Teams')
        setTimeout(() => navigate('/recruiter/applications'), 3000)
        return
      }

      if (data && data.success) {


  console.log('✅ Microsoft Teams connected successfully!')
  console.log('📍 About to navigate with teams_connected=true')
  console.log('📍 Current localStorage before navigate:', localStorage.getItem('reopen_interview_modal'))
          setStatus('success')
        setMessage('Successfully connected to Microsoft Teams!')
        setTimeout(() => {
                console.log('📍 Navigating NOW...')
          navigate('/recruiter/applications?teams_connected=true')
        }, 2000)
      } else {
        console.error('❌ Token exchange failed:', data)
          console.log('📍 Data received:', JSON.stringify(data))

        setStatus('error')
        setMessage(data?.message || 'Failed to connect Microsoft Teams')
        setTimeout(() => navigate('/recruiter/applications'), 3000)
      }
    } catch (err) {
      console.error('❌ Exception during OAuth callback:', err)
      setStatus('error')
      setMessage('An error occurred while connecting to Microsoft Teams')
      setTimeout(() => navigate('/recruiter/applications'), 3000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            {status === 'processing' && (
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
            )}
            {status === 'success' && (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
            )}
          </div>

          {/* Message */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'processing' && 'Connecting...'}
            {status === 'success' && 'Connected!'}
            {status === 'error' && 'Connection Failed'}
          </h2>
          
          <p className="text-gray-600 mb-6">
            {message}
          </p>

          {/* Auto-redirect message */}
          <p className="text-sm text-gray-500">
            {status === 'processing' && 'Please wait...'}
            {status === 'success' && 'Redirecting to applications...'}
            {status === 'error' && 'Redirecting back...'}
          </p>

          {/* Manual redirect button */}
          {status !== 'processing' && (
            <button
              onClick={() => navigate('/recruiter/applications?teams_connected=true')}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Applications
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
