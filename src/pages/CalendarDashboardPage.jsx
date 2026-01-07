// src/pages/CalendarDashboardPage.jsx
// Page wrapper for Calendar Dashboard (for routing)

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import CalendarDashboard from '../components/dashboard/CalendarDashboard'

export default function CalendarDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

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
        <CalendarDashboard />
      </div>
    </div>
  )
}