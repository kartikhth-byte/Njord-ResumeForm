import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { CheckCircle, Home, LogOut, Copy, Check } from 'lucide-react'

export default function SubmissionSuccess() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const [copied, setCopied] = useState(false)
  
  // Get reference number from navigation state
  const referenceNumber = location.state?.referenceNumber
  const position = location.state?.position

  // Redirect if no reference number (shouldn't happen, but safety check)
  useEffect(() => {
    if (!referenceNumber) {
      navigate('/dashboard')
    }
  }, [referenceNumber, navigate])

  const handleCopyReference = () => {
    navigator.clipboard.writeText(referenceNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (!referenceNumber) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Application Submitted Successfully!
            </h1>
            <p className="text-green-50 text-lg">
              Your maritime career application has been received
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Reference Number Box */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 mb-6 shadow-lg">
              <div className="text-center">
                <p className="text-blue-100 text-sm font-semibold uppercase tracking-wider mb-2">
                  Your Application Reference Number
                </p>
                <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4 backdrop-blur-sm">
                  <p className="text-white text-4xl font-bold tracking-wider font-mono">
                    {referenceNumber}
                  </p>
                </div>
                <button
                  onClick={handleCopyReference}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all text-sm font-medium backdrop-blur-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Reference Number
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-amber-900 font-semibold text-sm mb-1">
                    Please Save Your Reference Number
                  </h3>
                  <p className="text-amber-800 text-sm">
                    Keep this reference number safe. You'll need it to track your application status and for any future correspondence.
                  </p>
                </div>
              </div>
            </div>

            {/* Application Summary */}
            {position && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Position Applied For</p>
                <p className="text-lg font-semibold text-gray-900">{position}</p>
              </div>
            )}

            {/* What's Next */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What Happens Next?</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Our recruitment team will review your application</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>You can view your submitted application anytime from your dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>We will contact you within 5-7 business days</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-200"
              >
                <Home className="w-5 h-5" />
                Go to Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Need help? Contact us at{' '}
            <a href="mailto:support@njordships.com" className="text-blue-600 hover:text-blue-700 font-medium">
              support@njordships.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}