import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Component } from 'react'
import { AuthProvider, useAuth } from './components/auth/AuthContext'
import { supabase } from './lib/supabase'
import ApplicantRoute from './components/auth/ApplicantRoute'
import RecruiterRoute from './components/auth/RecruiterRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import FormSection from './pages/FormSection'
import FormLayout from './components/form/FormLayout'
import ReviewSubmit from './pages/ReviewSubmit'
import SubmissionSuccess from './pages/SubmissionSuccess'
import ViewApplication from './pages/ViewApplication'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsConditions from './pages/TermsConditions'
import RecruiterTeam from './pages/RecruiterTeam'
import RecruiterDashboard from './pages/RecruiterDashboard'
import RecruiterLogin from './pages/RecruiterLogin'
import RecruiterSetup from './pages/RecruiterSetup'
import Unauthorized from './pages/Unauthorized'
import RecruiterApplications from './pages/RecruiterApplications'
import CleanupDrafts from './pages/CleanupDrafts'

// ErrorBoundary component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-4">Please refresh the page and try again</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
  const { user, loading } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (loading) return

      if (!user) {
        // Not logged in - show applicant login
        navigate('/login', { replace: true })
        return
      }

      // Check user type
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single()

        if (profile?.user_type === 'recruiter') {
          navigate('/recruiter/dashboard', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      } catch (error) {
        console.error('Error checking user type:', error)
        navigate('/login', { replace: true })
      } finally {
        setChecking(false)
      }
    }

    checkAndRedirect()
  }, [user, loading, navigate])

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return null
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
<Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-conditions" element={<TermsConditions />} />
            <Route path="/recruiter/login" element={<RecruiterLogin />} />
            <Route path="/recruiter/setup" element={<RecruiterSetup />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/cleanup-drafts" element={<CleanupDrafts />} />

            <Route
                   path="/recruiter/applications"
                   element={
                    <RecruiterRoute>
                     <RecruiterApplications />
                    </RecruiterRoute>
                   }
                />

            {/* Public View Application Route (No Auth Required) */}
            <Route path="/application/view/:publicToken" element={<ViewApplication />} />
            
            {/* Applicant Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ApplicantRoute>
                  <Dashboard />
                </ApplicantRoute>
              }
            />
            
            <Route
              path="/application/form/section/:sectionId"
              element={
                <ApplicantRoute>
                  <ErrorBoundary>
                    <FormLayout>
                      <FormSection />
                    </FormLayout>
                  </ErrorBoundary>
                </ApplicantRoute>
              }
            />
            
            <Route
              path="/application/review"
              element={
                <ApplicantRoute>
                  <ReviewSubmit />
                </ApplicantRoute>
              }
            />
            
            <Route
              path="/application/success"
              element={
                <ApplicantRoute>
                  <SubmissionSuccess />
                </ApplicantRoute>
              }
            />

            {/* Recruiter Protected Routes */}
            <Route
              path="/recruiter/dashboard"
              element={
                <RecruiterRoute>
                  <RecruiterDashboard />
                </RecruiterRoute>
              }
            />
            
            <Route
              path="/recruiter/team"
              element={
                <RecruiterRoute>
                  <RecruiterTeam />
                </RecruiterRoute>
              }
            />
            
            {/* Catch-All Route - Must be LAST */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App