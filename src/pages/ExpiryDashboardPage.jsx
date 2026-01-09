// src/pages/ExpiryDashboardPage.jsx
// Page wrapper for Expiry Dashboard (for routing)

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import ExpiryDashboard from '../components/dashboard/ExpiryDashboard'

export default function ExpiryDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

    // Block access for applicants
  if (!loading && role !== 'recruiter' && role !== 'master_recruiter') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
          <Link to="/dashboard" className="mt-4 text-blue-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  useEffect(() => {
    // Only allow recruiters to access this page
    if (!user) {
      navigate('/login')
      return
    }
  }, [user, navigate])

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ExpiryDashboard />
      </div>
    </div>
  )
}