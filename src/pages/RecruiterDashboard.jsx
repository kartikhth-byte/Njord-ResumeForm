/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDisplayValue } from '../utils/formatUtils'
import { supabase } from '../lib/supabase'
import RejectionModal from '../components/recruiter/RejectionModal'
import StatusBadge from '../components/StatusBadge'
import { 
  FileText, 
  Clock, 
  UserCheck, 
  CheckCircle, 
  Search,
  Users,
  Eye,
  Calendar,
  AlertCircle,
  UserX,
  AlertTriangle
} from 'lucide-react'

export default function RecruiterDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, signOut } = useAuth()
  const { permissions, role, loading: permLoading } = usePermissions(user)
  
  // Initialize activeTab from URL parameter or default to 'needs-review'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'needs-review')
  const [applications, setApplications] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    needsReview: 0,
    inProgress: 0,
    completed: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchRef, setSearchRef] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Rejection Modal State
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [isRetakeModalOpen, setIsRetakeModalOpen] = useState(false)
  const [selectedRetakeApplication, setSelectedRetakeApplication] = useState(null)
  
  
  const itemsPerPage = 20
  
  // Helper function to update tab and URL
  const updateActiveTab = (newTab) => {
    setActiveTab(newTab)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', newTab)
    setSearchParams(newParams, { replace: true })
  }
  
  // Sync state with URL when navigating back
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'needs-review'
    setActiveTab(prev => prev !== tabFromUrl ? tabFromUrl : prev)
  }, [searchParams])

  useEffect(() => {
    if (user && !permLoading) {
      loadStats()
      loadApplications()
    }
  }, [user, permLoading, activeTab, currentPage])

  const loadStats = async () => {
    try {
      const { count: total } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .not('submitted_at', 'is', null)

      const { count: needsReview } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
        .not('submitted_at', 'is', null)

      const { count: inProgress } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
   .in('status', [
    'under_review',
    'test_scheduled',
    'test_passed',
    'interview_scheduled', 
    'interview_completed'
  ]) 
        .not('submitted_at', 'is', null)

      const { count: completed } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['hired', 'rejected', 'withdrawn'])
        .not('submitted_at', 'is', null)

      setStats({
        total: total || 0,
        needsReview: needsReview || 0,
        inProgress: inProgress || 0,
        completed: completed || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadApplications = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('applications')
        .select(`
          *,
          application_data (
            data
          )
        `, { count: 'exact' })
        .not('submitted_at', 'is', null)

      switch (activeTab) {
        case 'needs-review':
          query = query.eq('status', 'new')
          break
        case 'in-progress':
  query = query.in('status', [
    'under_review',
    'test_scheduled',
    'test_passed',
    'interview_scheduled',
    'interview_completed'
  ])
  break
        case 'archive':
          query = query.in('status', ['hired', 'rejected', 'withdrawn'])
          break
        case 'all':
          break
      }

      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      setApplications(data || [])
      setTotalPages(Math.ceil((count || 0) / itemsPerPage))
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle Rejection (Updates DB & triggers Modal callback)
  const handleReject = async (rejectionData) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('applications')
        .update({
          status: 'rejected',
          rejection_category: rejectionData.rejectionCategory,
          predefined_tags: rejectionData.predefinedTags,
          custom_tags: rejectionData.customTags,
          contact_for_future_roles: rejectionData.contactForFutureRoles,
          rejection_notes: rejectionData.rejectionNotes,
          rejected_at: rejectionData.rejectedAt,
          rejected_by: currentUser.id,
        })
        .eq('id', rejectionData.applicationId)

      if (error) throw error

      await loadApplications()
      await loadStats()
      setIsRejectionModalOpen(false)
      setSelectedApplication(null)
      alert('Application rejected successfully')
    } catch (error) {
      console.error('Error rejecting application:', error)
      throw error
    }
  }

  // Handle Approve Test Retake
  const handleApproveRetake = async (retakeData) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'test_scheduled',
          test_attempt_number: retakeData.nextAttempt,
        })
        .eq('id', retakeData.applicationId)

      if (error) throw error

      await loadApplications()
      await loadStats()
      setIsRetakeModalOpen(false)
      setSelectedRetakeApplication(null)
      alert('Test retake approved! Candidate will be notified.')
    } catch (error) {
      console.error('Error approving retake:', error)
      throw error
    }
  }

  // Handle Reject from Test Retake Modal
  const handleRejectFromRetake = async (rejectionData) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('applications')
        .update({
          status: 'rejected',
          rejection_category: rejectionData.rejectionCategory,
          rejection_notes: rejectionData.rejectionNotes,
          rejected_at: new Date().toISOString(),
          rejected_by: currentUser.id,
        })
        .eq('id', rejectionData.applicationId)

      if (error) throw error

      await loadApplications()
      await loadStats()
      setIsRetakeModalOpen(false)
      setSelectedRetakeApplication(null)
      alert('Application rejected successfully')
    } catch (error) {
      console.error('Error rejecting application:', error)
      throw error
    }
  }

  const handleSearchByRef = async (e) => {
    e.preventDefault()
    if (!searchRef.trim()) return

    try {
      const { data, error } = await supabase
        .from('applications')
        .select('public_token')
        .eq('reference_number', searchRef.trim())
        .single()

      if (error || !data) {
        alert('Application not found with reference number: ' + searchRef)
        return
      }
      navigate(`/application/view/${data.public_token}`)
    } catch (error) {
      alert('Application not found')
    }
  }

  const getApplicantData = (app) => {
    const section1 = app.application_data?.data?.section1 || {}
    const section2 = app.application_data?.data?.section2 || {}
    
    return {
      firstName: section2.firstName || '',
      middleName: section2.middleName || '',
      lastName: section2.surname || '',
      fullName: [section2.firstName, section2.middleName, section2.surname].filter(Boolean).join(' ').trim() || 'Unknown',
      email: section2.email || '', // Ensure email is present
      phoneNumber: section2.phoneNumber || section2.phone || '',
      nationality: section2.nationality || '',
      dateOfBirth: section2.dateOfBirth || '',
      placeOfBirth: section2.placeOfBirth || '',
      appliedForRank: section1.appliedForRank || '',
      vesselType: section1.vesselType || '',
      availableFrom: section1.availableFrom || ''
    }
  }

  const getActionButtons = (app) => {
    const applicantData = getApplicantData(app)
    
    const ViewButton = () => (
      <button
        onClick={() => navigate(`/application/view/${app.public_token}`)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Eye className="w-4 h-4" />
        View
      </button>
    )

    switch (app.status) {
      case 'new':
      case 'under_review':
      case 'interview_completed':
        return (
          <>
            <ViewButton />
            <button
              onClick={() => {
                setSelectedApplication({
                  id: app.id,
                  name: applicantData.fullName, // FIX: Standardized name
                  applicant_name: applicantData.fullName, // Legacy support
                  email: applicantData.email, // FIX: Added email for service
                  reference_number: app.reference_number,
                  status: app.status,
                  position: applicantData.appliedForRank
                })
                setIsRejectionModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <UserX className="w-4 h-4" />
              Reject
            </button>
          </>
        )
      
      default:
        return <ViewButton />
    }
  }

  const tabs = [
    { id: 'needs-review', label: 'Needs Review', icon: Clock, count: stats.needsReview },
    { id: 'in-progress', label: 'In Progress', icon: UserCheck, count: stats.inProgress },
    { id: 'archive', label: 'Archive', icon: CheckCircle, count: stats.completed },
    { id: 'all', label: 'All Applications', icon: Users, count: stats.total }
  ]

  if (permLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* HEADER - FIXED WITH BUTTONS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recruiter Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage and review seafarer applications</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Icon Navigation */}
            <button 
              onClick={() => navigate('/recruiter/calendar')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Calendar - Scheduled Interviews & Events"
            >
              <Calendar className="w-5 h-5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button 
              onClick={() => navigate('/dashboard/expiry')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              title="Document Expiry Tracking"
            >
              <AlertCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Expiry</span>
            </button>
            {(role === 'Master Recruiter') && (
              <button 
                onClick={() => navigate('/recruiter/team')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Team Management"
              >
                <Users className="w-5 h-5" />
                <span className="hidden sm:inline">Team</span>
              </button>
            )}
            
            <div className="h-8 w-px bg-gray-300 mx-1"></div>

            <button
              onClick={signOut}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Applications</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Needs Review</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.needsReview}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h2 className="text-xl font-bold mb-1">Manage All Applications</h2>
              <p className="text-blue-100 text-sm">View complete list, filter by status, and update application progress</p>
            </div>
            <button
              onClick={() => navigate('/recruiter/applications')}
              className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold shadow-md flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              View All Applications
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <form onSubmit={handleSearchByRef} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                placeholder="Search by reference number (e.g., NJD-123456)..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Search
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      updateActiveTab(tab.id)
                      setCurrentPage(1)
                    }}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Applications List */}
          <div className="divide-y">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading applications...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No applications found</p>
              </div>
            ) : (
              applications.map((app) => {
                const applicantData = getApplicantData(app)
                return (
                  <div key={app.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {applicantData.fullName}
                          </h3>
                          <StatusBadge status={app.status} />
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Reference</p>
                            <p className="font-mono text-blue-600">{app.reference_number}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Position</p>
                            <p className="font-medium">{formatDisplayValue(applicantData.appliedForRank)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vessel Type</p>
                            <p className="font-medium">{formatDisplayValue(applicantData.vesselType)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Nationality</p>
                            <p className="font-medium">{applicantData.nationality}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - Dynamic based on status */}
                      <div className="flex items-center gap-2 ml-4">
                        {getActionButtons(app)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FIXED MODAL PROPS: Using 'applicant' and 'onConfirm' */}
      <RejectionModal
        isOpen={isRejectionModalOpen}
        onClose={() => {
          setIsRejectionModalOpen(false)
          setSelectedApplication(null)
        }}
        applicant={selectedApplication} 
        onConfirm={handleReject} 
      />

    </div>
  )
}
