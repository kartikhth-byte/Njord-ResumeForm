/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { formatDisplayValue } from '../utils/formatUtils'
import { supabase } from '../lib/supabase'
import RejectionModal from '../components/recruiter/RejectionModal'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import StatusBadge from '../components/StatusBadge'
import PageHeader from '../components/ui/PageHeader'
import SegmentedControl from '../components/ui/SegmentedControl'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
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
  ArrowRight,
  RefreshCw,
  Video
} from 'lucide-react'

const NEEDS_REVIEW_STATUSES = ['submitted', 'new']
const IN_REVIEW_STATUSES = ['under_review']
const PIPELINE_STATUSES = [
  'test_scheduled',
  'test_completed',
  'test_passed',
  'test_failed',
  'interview_scheduled',
  'interview_completed',
  'interview_passed',
  'second_interview_scheduled',
  'second_interview_completed',
  'offered',
  'offer_accepted',
  'documents_pending'
]
const ARCHIVE_STATUSES = ['hired', 'rejected', 'withdrawn']

const EVENT_TYPE_CONFIG = {
  interview: {
    label: 'Interview',
    icon: Video,
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  test: {
    label: 'Test',
    icon: FileText,
    badgeClass: 'bg-purple-100 text-purple-800',
  },
}

function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00:00'}`)
}

export default function RecruiterDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const { permissions, role, loading: permLoading, canManageTeam, canViewTeam } = usePermissions()
  
  // Initialize activeTab from URL parameter or default to 'needs-review'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'needs-review')
  const [applications, setApplications] = useState([])
  const [scheduledEvents, setScheduledEvents] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    needsReview: 0,
    inReview: 0,
    inProgress: 0,
    completed: 0
  })
  const [loading, setLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [searchRef, setSearchRef] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [lastScheduleSyncAt, setLastScheduleSyncAt] = useState(null)
  
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
      loadScheduleSnapshot()
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
        .in('status', NEEDS_REVIEW_STATUSES)
        .not('submitted_at', 'is', null)

      const { count: inReview } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('status', IN_REVIEW_STATUSES)
        .not('submitted_at', 'is', null)

      const { count: inProgress } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('status', PIPELINE_STATUSES)
        .not('submitted_at', 'is', null)

      const { count: completed } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ARCHIVE_STATUSES)
        .not('submitted_at', 'is', null)

      setStats({
        total: total || 0,
        needsReview: needsReview || 0,
        inReview: inReview || 0,
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
          query = query.in('status', NEEDS_REVIEW_STATUSES)
          break
        case 'in-review':
          query = query.in('status', IN_REVIEW_STATUSES)
          break
        case 'in-progress':
          query = query.in('status', PIPELINE_STATUSES)
          break
        case 'archive':
          query = query.in('status', ARCHIVE_STATUSES)
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

  const loadScheduleSnapshot = async () => {
    try {
      setScheduleLoading(true)

      const todayKey = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('scheduled_events')
        .select(`
          id,
          event_type,
          event_title,
          platform,
          location_type,
          location_details,
          scheduled_date,
          scheduled_time,
          duration_minutes,
          status,
          application_id,
          applications (
            reference_number,
            applied_rank,
            application_data (
              data
            )
          )
        `)
        .gte('scheduled_date', todayKey)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(25)

      if (error) throw error

      setScheduledEvents(data || [])
      setLastScheduleSyncAt(new Date())
    } catch (error) {
      console.error('Error loading schedule snapshot:', error)
      setScheduledEvents([])
    } finally {
      setScheduleLoading(false)
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
      case 'submitted':
      case 'new':
        return (
          <>
            <button
              onClick={() => handleStartReview(app.id, app.public_token)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Clock className="w-4 h-4" />
              Start Review
            </button>
            <ViewButton />
          </>
        )
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

  const handleStartReview = async (applicationId, publicToken) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'under_review',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) throw error

      await loadStats()
      await loadApplications()
      navigate(`/application/view/${publicToken}`)
    } catch (error) {
      console.error('Error starting review:', error)
      alert('Failed to move application into review')
    }
  }

  const tabs = [
    { id: 'needs-review', label: 'Needs Review', icon: Clock, count: stats.needsReview },
    { id: 'in-review', label: 'In Review', icon: Eye, count: stats.inReview },
    { id: 'in-progress', label: 'In Progress', icon: UserCheck, count: stats.inProgress },
    { id: 'all', label: 'All Applications', icon: Users, count: stats.total }
  ]
  const tabOptions = tabs.map(tab => ({ value: tab.id, label: tab.label, icon: tab.icon, count: tab.count }))

  const scheduleSnapshot = (() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(todayStart.getDate() + 1)
    const weekEnd = new Date(todayStart)
    weekEnd.setDate(todayStart.getDate() + 7)

    const normalized = scheduledEvents
      .map((event) => {
        const eventDate = combineDateTime(event.scheduled_date, event.scheduled_time)
        if (!eventDate || Number.isNaN(eventDate.getTime())) return null

        const applicantData = event.applications?.application_data?.data?.section2 || {}
        const fullName = [applicantData.firstName, applicantData.middleName, applicantData.surname]
          .filter(Boolean)
          .join(' ')
          .trim()

        return {
          ...event,
          eventDate,
          fullName: fullName || event.event_title || event.applications?.reference_number || 'Applicant',
          position: event.applications?.applied_rank || 'Position not set',
          referenceNumber: event.applications?.reference_number || 'No reference',
        }
      })
      .filter(Boolean)
      .filter((event) => event.eventDate >= now)
      .sort((a, b) => a.eventDate - b.eventDate)

    return {
      today: normalized.filter((event) => event.eventDate >= todayStart && event.eventDate < tomorrowStart).length,
      thisWeek: normalized.filter((event) => event.eventDate >= todayStart && event.eventDate < weekEnd).length,
      pending: normalized.length,
      upcoming: normalized.slice(0, 4),
    }
  })()

  if (permLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Recruiter Dashboard"
            title="Queue-first recruiting operations"
            description="Keep urgent candidate review, scheduled activity, and pipeline movement in one surface. The dashboard should prioritize what needs attention next, not just summarize counts."
          />

          <div className="workspace-kpi-grid">
            <StatCard label="New Submissions" value={stats.needsReview} icon={Clock} tone="warning" hint="Fresh applications that have not been triaged yet." />
            <StatCard label="In Review" value={stats.inReview} icon={Eye} tone="accent" hint="Applications currently being assessed by recruiters." />
            <StatCard label="Pipeline Active" value={stats.inProgress} icon={UserCheck} tone="accent" hint="Testing, interviews, offers, or document follow-up." />
            <StatCard label="Completed" value={stats.completed} icon={CheckCircle} tone="success" hint="Hired, rejected, or withdrawn outcomes." />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
            <div className="recruiter-panel p-6">
              <div className="workspace-hero">
                <p className="workspace-hero__eyebrow">Work Queue</p>
                <h2 className="workspace-hero__title">Work the newest submissions first, then move candidates into active review.</h2>
                <p className="workspace-hero__description">Fresh applicant submissions belong in Needs Review. Once a recruiter picks one up, it should move into In Review and then continue through the wider hiring pipeline.</p>
                <div className="mt-5">
                  <button
                    onClick={() => navigate('/recruiter/applications')}
                    className="workspace-action-button workspace-action-button--primary"
                  >
                    <FileText className="w-4 h-4" />
                    Open applications workspace
                  </button>
                </div>
              </div>
            </div>

            <div className="recruiter-panel p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Reference Search</p>
              <h2 className="mt-2 text-lg font-semibold text-gray-900">Jump directly to a known application</h2>
              <form onSubmit={handleSearchByRef} className="mt-4 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchRef}
                    onChange={(e) => setSearchRef(e.target.value)}
                    placeholder="Search by reference number (e.g. NJD-123456)"
                    className="h-11 w-full rounded-2xl border border-gray-300 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
                  />
                </div>
                <button type="submit" className="workspace-action-button workspace-action-button--secondary">
                  Search
                </button>
              </form>

              <div className="mt-6 space-y-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Priority signals</p>
                  <p className="mt-1 text-sm text-gray-600">Use these counts to decide where to spend recruiter time first.</p>
                </div>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Needs review</span>
                    <span className="font-semibold text-amber-700">{stats.needsReview}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>In review now</span>
                    <span className="font-semibold text-sky-700">{stats.inReview}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pipeline in motion</span>
                    <span className="font-semibold text-teal-700">{stats.inProgress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Archive volume</span>
                    <span className="font-semibold text-gray-900">{stats.completed}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="recruiter-panel p-6">
            <div className="flex flex-col gap-5 border-b border-gray-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Upcoming Schedule</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Interviews and tests coming up next.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                  Use this snapshot to see what is happening today, what is coming this week, and which events need attention next.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {lastScheduleSyncAt ? (
                  <span className="text-sm text-slate-500">
                    Last synced {lastScheduleSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={loadScheduleSnapshot}
                  className="workspace-action-button workspace-action-button--secondary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/recruiter/calendar')}
                  className="workspace-action-button workspace-action-button--primary"
                >
                  <Calendar className="h-4 w-4" />
                  Open Calendar
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Today</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{scheduleSnapshot.today}</p>
                <p className="mt-1 text-sm text-slate-600">Interviews or tests scheduled today.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">This Week</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{scheduleSnapshot.thisWeek}</p>
                <p className="mt-1 text-sm text-slate-600">Upcoming events over the next 7 days.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pending</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{scheduleSnapshot.pending}</p>
                <p className="mt-1 text-sm text-slate-600">Future interviews and tests currently scheduled.</p>
              </div>
            </div>

            <div className="mt-6">
              {scheduleLoading ? (
                <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-slate-600">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                    <span>Loading upcoming schedule...</span>
                  </div>
                </div>
              ) : scheduleSnapshot.upcoming.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <Calendar className="mx-auto h-10 w-10 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">No interviews or tests scheduled</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    When recruiters schedule interviews or tests, the next upcoming items will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {scheduleSnapshot.upcoming.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.interview
                    const EventIcon = config.icon

                    return (
                      <div key={event.id} className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${config.badgeClass}`}>
                              <EventIcon className="h-3.5 w-3.5" />
                              {config.label}
                            </div>
                            <h3 className="mt-3 text-lg font-semibold text-slate-950">{event.fullName}</h3>
                            <p className="mt-1 text-sm text-slate-600">{formatDisplayValue(event.position)}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {event.referenceNumber}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span>
                              {event.eventDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span>
                              {event.eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {event.duration_minutes ? ` · ${event.duration_minutes} min` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-slate-400" />
                            <span>{event.platform || event.location_type || 'Schedule details available in calendar'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="recruiter-panel overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Recruiter Queue</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    {activeTab === 'needs-review'
                      ? 'Fresh submissions waiting for first review'
                      : activeTab === 'in-review'
                        ? 'Applications currently being reviewed'
                        : activeTab === 'in-progress'
                          ? 'Candidates already moving through the pipeline'
                          : 'All submitted applications'}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <SegmentedControl
                    options={tabOptions}
                    value={activeTab}
                    onChange={(nextTab) => {
                      updateActiveTab(nextTab)
                      setCurrentPage(1)
                    }}
                  />
                  {stats.completed > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        updateActiveTab('archive')
                        setCurrentPage(1)
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'archive'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Archive
                      <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">
                        {stats.completed}
                      </span>
                    </button>
                  ) : null}
                </div>
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
              <div className="p-8">
                <EmptyState
                  icon={FileText}
                  title={activeTab === 'needs-review' ? 'No fresh submissions are waiting right now' : 'No applications found in this queue'}
                  description={
                    activeTab === 'needs-review'
                      ? 'New applicant submissions will appear here first. Use In Review, In Progress, or All Applications to inspect the rest of the pipeline.'
                      : 'Switch queues or open the full applications workspace if you need broader search and filtering.'
                  }
                />
              </div>
            ) : (
              applications.map((app) => {
                const applicantData = getApplicantData(app)
                return (
                  <div key={app.id} className="p-6 transition-colors hover:bg-gray-50/60">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
                            {applicantData.fullName}
                          </h3>
                          <StatusBadge status={app.status} />
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold tracking-wide text-gray-600">
                            {app.reference_number}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <p className="text-gray-500">Position</p>
                            <p className="font-medium text-gray-900">{formatDisplayValue(applicantData.appliedForRank)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vessel Type</p>
                            <p className="font-medium text-gray-900">{formatDisplayValue(applicantData.vesselType)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Nationality</p>
                            <p className="font-medium text-gray-900">{applicantData.nationality || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Available</p>
                            <p className="font-medium text-gray-900">{applicantData.availableFrom || 'Unavailable'}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
                          <span>{applicantData.email || 'No email'}</span>
                          <span>{applicantData.phoneNumber || 'No phone'}</span>
                        </div>
                      </div>

                      {/* Action Buttons - Dynamic based on status */}
                      <div className="flex flex-wrap items-center gap-2 lg:ml-6">
                        {getActionButtons(app)}
                        <button
                          onClick={() => navigate(`/application/view/${app.public_token}`)}
                          className="workspace-action-button workspace-action-button--secondary"
                        >
                          Open detail
                          <ArrowRight className="h-4 w-4" />
                        </button>
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
