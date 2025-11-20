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
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState([])
  const [draftApplication, setDraftApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)

  useEffect(() => {
    if (user) {
      fetchApplications()
    }
  }, [user])

  const fetchApplications = async () => {
    try {
      setLoading(true)

      // Fetch all applications for this user
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .order('version_number', { ascending: false })

      if (error) throw error

      // Separate draft and submitted
      const draft = data?.find(app => app.status === 'draft')
      const submitted = data?.filter(app => app.status === 'submitted') || []

      setDraftApplication(draft)
      setApplications(submitted)

      // If there's a draft, fetch its data
      if (draft) {
        const { data: appData, error: dataError } = await supabase
          .from('application_data')
          .select('*')
          .eq('application_id', draft.id)
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
      // Create new application
      const { data: newApp, error: appError } = await supabase
        .from('applications')
        .insert([
          {
            user_id: user.id,
            version_number: applications.length + 1,
            status: 'draft',
          },
        ])
        .select()
        .single()

      if (appError) throw appError

      // Create application_data entry
      const { error: dataError } = await supabase
        .from('application_data')
        .insert([
          {
            application_id: newApp.id,
            data: {},
          },
        ])

      if (dataError) throw dataError

      // Navigate to section 1
      navigate(`/application/form/section/1`)
    } catch (error) {
      console.error('Error creating application:', error)
      alert('Failed to create application. Please try again.')
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
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', draftApplication.id)

      if (error) throw error

      // Refresh applications
      fetchApplications()
    } catch (error) {
      console.error('Error deleting draft:', error)
      alert('Failed to delete draft. Please try again.')
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
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                          Submitted
                        </span>
                        <span className="text-sm text-gray-500">Version {app.version_number}</span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium">
                        {app.applied_rank || 'Position not specified'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted: {new Date(app.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/application/view/${app.public_token}`)}
                      className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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