import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import { AuthProvider } from './components/auth/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
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

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-conditions" element={<TermsConditions />} />
            
            {/* Public View Application Route (No Auth Required) */}
            <Route path="/application/view/:publicToken" element={<ViewApplication />} />
            
            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/application/form/section/:sectionId"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <FormLayout>
                      <FormSection />
                    </FormLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/application/review"
              element={
                <ProtectedRoute>
                  <ReviewSubmit />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/application/success"
              element={
                <ProtectedRoute>
                  <SubmissionSuccess />
                </ProtectedRoute>
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