import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  CheckCircle,
  Calendar,
  User,
  FileCheck,
  Briefcase,
  Heart,
  Award,
  Ship,
  Shield,
  Book,
  Anchor,
  MessageSquare,
  FileText,
  Globe,
  GraduationCap,
  Users,
  Languages,
  Activity,
  Ruler,
  Flag,
  BarChart3,
  Building,
  DollarSign
} from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'

const SECTION_INFO = [
  { id: 1, title: 'Availability & Application', icon: Calendar },
  { id: 2, title: 'Personal & Contact Details', icon: User },
  { id: 3, title: 'Passport Details', icon: FileCheck },
  { id: 4, title: 'CDC / Seaman\'s Book', icon: Briefcase },
  { id: 5, title: 'Visas', icon: Globe },
  { id: 6, title: 'Education Background', icon: GraduationCap },
  { id: 7, title: 'Dependents', icon: Users },
  { id: 8, title: 'Certificates of Competency', icon: Award },
  { id: 9, title: 'GMDSS Certificates', icon: Shield },
  { id: 10, title: 'Medical & Vaccination', icon: Heart },
  { id: 11, title: 'Medical History', icon: Activity },
  { id: 12, title: 'Foreign Languages', icon: Languages },
  { id: 13, title: 'Physical & Uniform Details', icon: Ruler },
  { id: 14, title: 'STCW & Marine Courses', icon: Book },
  { id: 15, title: 'Flag State Documents', icon: Flag },
  { id: 16, title: 'Sea Service', icon: Anchor },
  { id: 17, title: 'Experience Summary', icon: BarChart3 },
  { id: 18, title: 'References', icon: MessageSquare },
  { id: 19, title: 'Bank Details', icon: DollarSign },
  { id: 20, title: 'Declaration & Consent', icon: FileText },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState([])
  const [draftApplication, setDraftApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)
  const [copiedRef, setCopiedRef] = useState(null)

  // Fetch applications
  useEffect(() => {
    if (user) {
      fetchApplications()
    }
  }, [user])

  const fetchApplications = async () => {
    try {
      setLoading(true)

      // UPDATED: Fetch all applications, order by created_at (no version_number)
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Separate in-progress and submitted applications
      // In-progress applications have status 'new' and are not yet submitted
      const inProgress = data?.find(app => app.status === 'new' && !app.submitted_at)
      const submitted = data?.filter(app => 
        app.submitted_at !== null || (app.status !== 'new' && app.status !== null)
      ) || []

      setDraftApplication(inProgress)
      setApplications(submitted)

      // If there's an in-progress application, fetch its data
      if (inProgress) {
        const { data: appData, error: dataError } = await supabase
          .from('application_data')
          .select('*')
          .eq('application_id', inProgress.id)
          .single()

        if (dataError) throw dataError
        setApplicationData(appData?.data || {})
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartApplication = async () => {
    try {
      // UPDATED: Simplified logic - no version calculation
      // Check if there's already an in-progress draft
      if (draftApplication) {
        // If draft exists, just navigate to it
        navigate(`/application/form/section/1`)
        return
      }

      // Check if there's a previous submitted application to copy from
      let previousData = {}
      if (applications.length > 0) {
        // Get the most recent submitted application
        const latestApp = applications[0] // Already sorted by created_at desc
        
        // Fetch its data
        const { data: prevAppData, error: prevDataError } = await supabase
          .from('application_data')
          .select('data')
          .eq('application_id', latestApp.id)
          .single()
        
        if (prevDataError) {
          console.error('Error fetching previous data:', prevDataError)
        } else if (prevAppData) {
          previousData = prevAppData.data || {}
        }
      }

      console.log('Creating new draft application...')

      // UPDATED: Create application WITHOUT version_number
      const { data: newApp, error: appError } = await supabase
        .from('applications')
        .insert([
          {
            user_id: user.id,
            status: 'new',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
        ])
        .select()
        .single()

      if (appError) {
        console.error('Error creating application:', appError)
        throw appError
      }

      // Create application_data entry with copied data
      const { error: dataError } = await supabase
        .from('application_data')
        .insert([
          {
            application_id: newApp.id,
            data: previousData, // Use copied data if available
          },
        ])

      if (dataError) {
        console.error('Error creating application_data:', dataError)
        throw dataError
      }

      // Show message if data was copied
      if (Object.keys(previousData).length > 0) {
        alert('New draft created with data from your previous application. Review and update as needed.')
      }

      // Navigate to section 1
      navigate(`/application/form/section/1`)
    } catch (error) {
      console.error('Error in handleStartApplication:', error)
      alert(`Failed to create application: ${error.message}`)
    }
  }

  const handleContinueApplication = () => {
    navigate(`/application/form/section/1`)
  }

  const handleReviewAndSubmit = () => {
    navigate(`/application/review`)
  }

  const handleDiscardDraft = async () => {
    if (!window.confirm('Are you sure you want to discard this draft? This cannot be undone.')) {
      return
    }

    try {
      console.log('Discarding draft:', draftApplication?.id)
      
      // Delete application_data first (foreign key constraint)
      const { error: dataError } = await supabase
        .from('application_data')
        .delete()
        .eq('application_id', draftApplication.id)

      if (dataError) {
        console.error('Error deleting application_data:', dataError)
        throw dataError
      }
      console.log('Application_data deleted')

      // Then delete the application
      const { error: appError } = await supabase
        .from('applications')
        .delete()
        .eq('id', draftApplication.id)

      if (appError) {
        console.error('Error deleting application:', appError)
        throw appError
      }
      console.log('Application deleted')

      // Clear state immediately
      setDraftApplication(null)
      setApplicationData(null)
      
      // Refresh applications
      await fetchApplications()
      
      alert('Draft discarded successfully')
      
      // Force page reload to ensure UI updates
      window.location.reload()
    } catch (error) {
      console.error('Error in handleDiscardDraft:', error)
      alert(`Failed to delete draft: ${error.message}`)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Calculate progress
  const calculateProgress = () => {
    if (!applicationData) return 0

    const sections = [
      'section1', 'section2', 'section3', 'section4', 'section5',
      'section6', 'section7', 'section8', 'section9', 'section10',
      'section11', 'section12', 'section13', 'section14', 'section15',
      'section16', 'section17', 'section18', 'section19', 'section20'
    ]

    const completedSections = sections.filter(section => {
      const sectionData = applicationData[section]
      return sectionData && Object.keys(sectionData).length > 0
    })

    return Math.round((completedSections.length / sections.length) * 100)
  }

  // Check if section is completed
  const isSectionCompleted = (sectionId) => {
    if (!applicationData) return false
    const sectionData = applicationData[`section${sectionId}`]
    return sectionData && Object.keys(sectionData).length > 0
  }


  // Regular loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Njordships</h1>
              <p className="text-sm text-gray-600">Maritime Recruitment Portal</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.user_metadata?.full_name || user?.email}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Welcome back!</h2>
          <p className="text-gray-600 mt-1">Manage your maritime career applications</p>
        </div>

        {/* State 1: No applications - Show "Apply Now" CTA */}
        {!draftApplication && applications.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <svg
                  className="w-10 h-10 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Ready to apply for a maritime position?
              </h3>
              <p className="text-gray-600 mb-8">
                Start your application now. You can save your progress and continue anytime.
              </p>
              <button
                onClick={handleStartApplication}
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Apply Now
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* State 2: Draft in progress */}
        {draftApplication && (
          <>
            {/* Progress Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                      Draft
                    </span>
                    <span className="text-sm text-gray-500">In Progress</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Your Application</h3>
                </div>
                <button
                  onClick={handleDiscardDraft}
                  className="text-sm text-red-600 hover:text-red-700 hover:underline"
                >
                  Discard Draft
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm text-gray-600">{calculateProgress()}% complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${calculateProgress()}%` }}
                  ></div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Last saved: {new Date(draftApplication.updated_at).toLocaleString()}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleContinueApplication}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Continue Application
                </button>
              </div>
            </div>

            {/* Review & Submit Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Submit?</h3>
                  <p className="text-blue-100">
                    Review your application and submit when you're ready
                  </p>
                </div>
                <button
                  onClick={handleReviewAndSubmit}
                  className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium shadow-lg"
                >
                  Review & Submit
                </button>
              </div>
            </div>

            {/* Section Cards Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Application Sections (20 Total)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {SECTION_INFO.map((section) => {
                  const Icon = section.icon
                  const isCompleted = isSectionCompleted(section.id)

                  return (
                    <button
                      key={section.id}
                      onClick={() => navigate(`/application/form/section/${section.id}`)}
                      className="flex items-center gap-3 p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 group-hover:text-blue-600">
                          Section {section.id}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {section.title}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* State 3: Submitted applications */}
        {applications.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Your Applications</h3>
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
<span className={`px-3 py-1 text-xs font-semibold rounded-full ${
  app.status === 'new' ? 'bg-blue-100 text-blue-800' :
  app.status === 'interview_scheduled' ? 'bg-purple-100 text-purple-800' :
  app.status === 'interview_cleared' ? 'bg-indigo-100 text-indigo-800' :
  app.status === 'test_scheduled' ? 'bg-orange-100 text-orange-800' :
  app.status === 'test_cleared' ? 'bg-teal-100 text-teal-800' :
  app.status === 'hired' ? 'bg-green-100 text-green-800' :
  app.status === 'rejected' ? 'bg-red-100 text-red-800' :
  app.status === 'withdrawn' ? 'bg-gray-100 text-gray-800' :
  'bg-green-100 text-green-800'
}`}>
  {app.status === 'new' ? 'New' :
   app.status === 'interview_scheduled' ? 'Interview Scheduled' :
   app.status === 'interview_cleared' ? 'Interview Cleared' :
   app.status === 'test_scheduled' ? 'Test Scheduled' :
   app.status === 'test_cleared' ? 'Test Cleared' :
   app.status === 'hired' ? 'Hired' :
   app.status === 'rejected' ? 'Rejected' :
   app.status === 'withdrawn' ? 'Withdrawn' :
   'Submitted'}
</span>
                        <span className="text-sm text-gray-500">Version {app.version_number}</span>
                      </div>

                      {/* Reference Number */}
                      {app.reference_number && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500">Ref:</span>
                          <span className="text-sm font-mono font-semibold text-blue-600">
                            {app.reference_number}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(app.reference_number)
                              setCopiedRef(app.reference_number)
                              setTimeout(() => setCopiedRef(null), 2000)
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Copy reference number"
                          >
                            {copiedRef === app.reference_number ? (
                              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}

                      <p className="text-sm text-gray-900 font-medium">
                        {formatDisplayValue(app.applied_rank) || 'Position not specified'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted: {new Date(app.submitted_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/application/view/${app.public_token}`)}
                      className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                    >
                      View Application
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Create New Version Button */}
            {!draftApplication && (
              <button
                onClick={handleStartApplication}
                className="mt-4 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Create New Version
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}