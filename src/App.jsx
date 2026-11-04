import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Component } from 'react'
import { AuthProvider, useAuth } from './components/auth/AuthContext'
import { usePermissions } from './hooks/usePermissions'
import { useThemeForRoute } from './hooks/useThemeForRoute'

import ApplicantRoute from './components/auth/ApplicantRoute'
import RecruiterRoute from './components/auth/RecruiterRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import FormSection from './pages/FormSection'
import FormLayout from './components/form/FormLayout'
import ReviewSubmit from './pages/ReviewSubmit'
import ViewApplication from './pages/ViewApplication'
import RecruiterDashboard from './pages/RecruiterDashboardSimple'
import RecruiterKpiPage from './pages/RecruiterKpiPage'
import RecruiterLogin from './pages/RecruiterLogin'
import RecruiterSetup from './pages/RecruiterSetup'
import RecruiterResetPassword from './pages/RecruiterResetPassword'
import Unauthorized from './pages/Unauthorized'
import RecruiterApplications from './pages/RecruiterApplications'
import ExpiryDashboardPage from './pages/ExpiryDashboardPage'
import CalendarDashboardPage from './pages/CalendarDashboardPage'
import MicrosoftOAuthCallback from './pages/MicrosoftOAuthCallback'
import RecruiterSettings from './pages/RecruiterSettings'
import RecruiterProspectDetail from './pages/RecruiterProspectDetail'
import RecruiterRequirementDetail from './pages/RecruiterRequirementDetail'
import RecruiterRequirementsPage from './pages/RecruiterRequirementsPage'
import RecruiterCandidatesPage from './pages/RecruiterCandidatesPage'

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { user, userType, loading: authLoading, authorizationLoading } = useAuth()
  const { role, loading } = usePermissions(user)

  if (authLoading || (user && (authorizationLoading || loading))) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/recruiter/login" replace />
  }

  if (userType !== 'recruiter') {
    return <Navigate to="/unauthorized" replace />
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

// ErrorBoundary component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-raised">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-fg mb-2">Something went wrong</h1>
            <p className="text-fg-secondary mb-4">Please refresh the page and try again</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-fill-hover"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function RootRedirect() {
  const navigate = useNavigate()
  const { user, loading, userType, authorizationLoading } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAndRedirect = () => {
      if (loading) return

      if (!user) {
        // Applicants only ever arrive via emailed invite/sign-in links, so the
        // bare root URL is a staff entry point.
        navigate('/recruiter/login', { replace: true })
        setChecking(false)
        return
      }

      if (authorizationLoading && !userType) {
        return
      }

      if (userType === 'recruiter') {
        navigate('/recruiter/dashboard', { replace: true })
      } else if (userType === 'applicant') {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/recruiter/login', { replace: true })
      }

      setChecking(false)
    }

    checkAndRedirect()
  }, [user, userType, loading, authorizationLoading, navigate])

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    )
  }

  return null
}

function WorkspaceRedirect() {
  const [searchParams] = useSearchParams()
  return <Navigate to={searchParams.get('tab') === 'candidates' ? '/recruiter/candidates' : '/recruiter/requirements'} replace />
}

function RecruiterProspectDetailRedirect() {
  const { prospectId } = useParams()
  return <Navigate to={`/recruiter/workspace/prospects/${prospectId}`} replace />
}

function RecruiterRequirementDetailRedirect() {
  const { requirementId } = useParams()
  return <Navigate to={`/recruiter/workspace/requirements/${requirementId}`} replace />
}

function ThemeSync() {
  useThemeForRoute()
  return null
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeSync />
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Navigate to="/recruiter/login" replace />} />
            <Route path="/applicant/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/recruiter/login" element={<RecruiterLogin />} />
            <Route path="/recruiter/setup" element={<RecruiterSetup />} />
            <Route path="/recruiter/reset-password" element={<RecruiterResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/auth/microsoft/callback" element={<MicrosoftOAuthCallback />} />
            

{/* Old Expiry address; the page moved to /recruiter/expiry. */}
<Route path="/dashboard/expiry" element={<Navigate to="/recruiter/expiry" replace />} />

<Route path="/recruiter/expiry" element={
  <ProtectedRoute allowedRoles={['Recruiter', 'Master Recruiter']}>
    <ExpiryDashboardPage />
  </ProtectedRoute>
} />

<Route path="/recruiter/calendar" element={
  <ProtectedRoute allowedRoles={['Recruiter', 'Master Recruiter', 'Coordinator']}>
    <CalendarDashboardPage />
  </ProtectedRoute>
} />


            
            <Route path="/recruiter/applications" element={
              <RecruiterRoute>
                <RecruiterApplications />
              </RecruiterRoute>
            } />

            {/* The Workspace page was merged into Requirements and Candidates. */}
            <Route path="/recruiter/workspace" element={
              <RecruiterRoute>
                <WorkspaceRedirect />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/workspace/prospects/:prospectId" element={
              <RecruiterRoute>
                <RecruiterProspectDetail />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/workspace/requirements/:requirementId" element={
              <RecruiterRoute>
                <RecruiterRequirementDetail />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/dashboard" element={
              <RecruiterRoute>
                <RecruiterDashboard />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/kpi" element={
              <RecruiterRoute>
                <RecruiterKpiPage />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/requirements" element={
              <RecruiterRoute>
                <RecruiterRequirementsPage />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/candidates" element={
              <RecruiterRoute>
                <RecruiterCandidatesPage />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/dashboard/prospects/:prospectId" element={
              <RecruiterRoute>
                <RecruiterProspectDetailRedirect />
              </RecruiterRoute>
            } />

            <Route path="/recruiter/dashboard/requirements/:requirementId" element={
              <RecruiterRoute>
                <RecruiterRequirementDetailRedirect />
              </RecruiterRoute>
            } />
            
            <Route path="/recruiter/settings" element={
              <RecruiterRoute>
                <RecruiterSettings />
              </RecruiterRoute>
            } />

            {/* Public View Application Route */}
            <Route path="/application/view/:publicToken" element={<ViewApplication />} />
            
            {/* Applicant Protected Routes */}
            <Route path="/dashboard" element={
              <ApplicantRoute>
                <Dashboard />
              </ApplicantRoute>
            } />
            
            <Route path="/application/form/section/:sectionId" element={
              <ApplicantRoute>
                <ErrorBoundary>
                  <FormLayout>
                    <FormSection />
                  </FormLayout>
                </ErrorBoundary>
              </ApplicantRoute>
            } />
            
            <Route path="/application/review" element={
              <ApplicantRoute>
                <ReviewSubmit />
              </ApplicantRoute>
            } />
            
            {/* Old success page: confirmation now shows on the submitted application. */}
            <Route path="/application/success" element={<Navigate to="/dashboard" replace />} />

            {/* Catch-All Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
