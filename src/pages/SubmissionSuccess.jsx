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
    <div className="applicant-shell flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="applicant-panel overflow-hidden">
          <div className="p-8 text-center bg-success">
            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-surface">
              <CheckCircle className="h-12 w-12 text-success" />
            </div>
            <h1 className="text-3xl font-semibold text-fg mb-2">
              Application Submitted Successfully!
            </h1>
            <p className="text-success text-lg">
              Your maritime career application has been received
            </p>
          </div>

          <div className="p-8">
            <div className="applicant-hero mb-6">
              <div className="text-center">
                <p className="text-accent-text text-sm font-semibold mb-2">
                  Your Application Reference Number
                </p>
                <div className="mb-4 rounded-card bg-raised p-4">
                  <p className="text-4xl font-semibold tracking-wider text-fg font-mono">
                    {referenceNumber}
                  </p>
                </div>
                <button
                  onClick={handleCopyReference}
                  className="applicant-action applicant-action--primary"
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

            <div className="mb-6 rounded-[24px] border border-warning-line bg-warning-soft p-5">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-warning mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-warning font-semibold text-sm mb-1">
                    Please Save Your Reference Number
                  </h3>
                  <p className="text-warning text-sm">
                    Keep this reference number.
                  </p>
                </div>
              </div>
            </div>

            {position && (
              <div className="mb-6 rounded-[24px] border border-line bg-raised p-5">
                <p className="text-sm text-fg-secondary mb-1">Position Applied For</p>
                <p className="text-lg font-semibold text-fg">{position}</p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-fg mb-3">What Happens Next?</h3>
              <ul className="space-y-2 text-fg-secondary">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Our recruitment team will review your application</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>You can view your submitted application anytime from your dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>We will contact you within 5-7 business days</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="applicant-action applicant-action--primary flex-1"
              >
                <Home className="w-5 h-5" />
                Go to Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="applicant-action applicant-action--secondary flex-1"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
