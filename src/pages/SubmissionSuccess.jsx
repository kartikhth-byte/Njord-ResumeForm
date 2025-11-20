import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/layout/Navbar'
import { CheckCircle, Download, FileText, Mail, Home } from 'lucide-react'

export default function SubmissionSuccess() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [application, setApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  useEffect(() => {
    if (user) {
      loadSubmittedApplication()
    }
  }, [user])

  const loadSubmittedApplication = async () => {
    try {
      setLoading(true)

      // Get the most recently submitted application
      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()

      if (appError) throw appError

      setApplication(app)

      // Get application data
      const { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('*')
        .eq('application_id', app.id)
        .single()

      if (dataError) throw dataError

      setApplicationData(appData?.data || {})
    } catch (error) {
      console.error('Error loading application:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    setGeneratingPDF(true)
    try {
      // We'll implement this in Part 2
      const { generateApplicationPDF } = await import('../utils/pdfGenerator')
      await generateApplicationPDF(application, applicationData)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No submitted application found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Application Submitted Successfully!
          </h1>
          
          <p className="text-lg text-gray-600">
            Thank you for applying. Your application has been received.
          </p>
        </div>

        {/* Application Details Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Application Details</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100">
              <span className="font-medium text-gray-700">Application ID:</span>
              <span className="col-span-2 text-gray-900 font-mono">
                #{application.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100">
              <span className="font-medium text-gray-700">Submission Date:</span>
              <span className="col-span-2 text-gray-900">
                {new Date(application.submitted_at).toLocaleString('en-US', {
                  dateStyle: 'full',
                  timeStyle: 'short'
                })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100">
              <span className="font-medium text-gray-700">Status:</span>
              <span className="col-span-2">
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                  Under Review
                </span>
              </span>
            </div>

            {applicationData?.section2?.firstName && (
              <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100">
                <span className="font-medium text-gray-700">Applicant Name:</span>
                <span className="col-span-2 text-gray-900">
                  {applicationData.section2.firstName} {applicationData.section2.lastName}
                </span>
              </div>
            )}

            {applicationData?.section1?.appliedForRank && (
              <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100">
                <span className="font-medium text-gray-700">Position Applied:</span>
                <span className="col-span-2 text-gray-900">
                  {applicationData.section1.appliedForRank}
                </span>
              </div>
            )}

            {applicationData?.section2?.email && (
              <div className="grid grid-cols-3 gap-4 py-3">
                <span className="font-medium text-gray-700">Email:</span>
                <span className="col-span-2 text-gray-900">
                  {applicationData.section2.email}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* What Happens Next */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">What Happens Next?</h3>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-medium text-blue-900">Email Confirmation</p>
                <p className="text-sm text-blue-800">
                  You will receive a confirmation email at {applicationData?.section2?.email || 'your registered email'} within the next few minutes.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-medium text-blue-900">Application Review</p>
                <p className="text-sm text-blue-800">
                  Our recruitment team will review your application within 5-7 business days.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-medium text-blue-900">Next Steps</p>
                <p className="text-sm text-blue-800">
                  If your profile matches our requirements, we will contact you via email or phone for the next steps.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {generatingPDF ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Application PDF
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>

        {/* Important Notes */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Mail className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-1">Important Notes</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Keep your application ID for future reference</li>
                <li>• Check your email (including spam folder) for updates</li>
                <li>• You can track your application status from the dashboard</li>
                <li>• Contact us if you don't hear back within 10 business days</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Questions about your application?{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}