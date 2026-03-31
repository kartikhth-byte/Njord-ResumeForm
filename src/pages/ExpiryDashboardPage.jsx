// src/pages/ExpiryDashboardPage.jsx
// Page wrapper for Expiry Dashboard (for routing)

import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import ExpiryDashboard from '../components/dashboard/ExpiryDashboard'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'

export default function ExpiryDashboardPage() {
  const { user, profile, signOut } = useAuth()
  const { role, loading } = usePermissions(user)
  const navigate = useNavigate()

  useEffect(() => {
    // Only allow recruiters to access this page
    if (!user) {
      navigate('/login')
      return
    }
  }, [user, navigate])

  // Show loading state
  if (loading) {
    return (
      <div className="recruiter-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900"></div>
          <p className="text-slate-600">Loading expiry workspace...</p>
        </div>
      </div>
    )
  }

  // Block access for applicants
  if (role !== 'Recruiter' && role !== 'Master Recruiter') {
    return (
      <div className="recruiter-shell flex min-h-screen items-center justify-center px-4">
        <div className="recruiter-panel max-w-lg p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-red-600">Access Denied</h2>
          <p className="text-slate-600">
            You don't have permission to access this page.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="recruiter-shell">
      <RecruiterTopbar
        user={user}
        profile={profile}
        role={role}
        signOut={signOut}
      />
      <RecruiterWorkspaceNav />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ExpiryDashboard />
      </div>
    </div>
  )
}
