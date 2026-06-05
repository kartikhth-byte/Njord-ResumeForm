import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import PageHeader from '../components/ui/PageHeader'
import SegmentedControl from '../components/ui/SegmentedControl'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import { downloadCsvReport, downloadPdfReport, logRecruiterExport } from '../services/recruiterReportExportService'
import {
  ArrowRight,
  BarChart2,
  BriefcaseBusiness,
  Calendar,
  Clock,
  FileBarChart2,
  FileText,
  Layers3,
  ListChecks,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  UsersRound,
} from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import {
  buildLookupMap,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  getLookupName,
  getStatusMeta,
  PROSPECT_STATUS_META,
  REQUIREMENT_STATUS_META,
} from './recruiterDashboardUtils'

const DASHBOARD_TABS = [
  { id: 'operations', label: 'Operations', icon: BriefcaseBusiness, visible: () => true },
  { id: 'prospects', label: 'Prospects', icon: UsersRound, visible: ({ permissions }) => permissions.includes('view_prospects') },
  { id: 'requirements', label: 'Requirements', icon: FileText, visible: ({ permissions }) => permissions.includes('view_requirements') },
  { id: 'funnel', label: 'Funnel', icon: Layers3, visible: ({ permissions }) => permissions.includes('view_prospects') || permissions.includes('view_requirements') || permissions.includes('view_applications') },
  { id: 'kpi', label: 'KPI', icon: BarChart2, visible: ({ permissions }) => permissions.includes('view_audit_log') || permissions.includes('view_analytics') || permissions.includes('view_applications') },
  { id: 'reports', label: 'Reports', icon: FileBarChart2, visible: ({ permissions }) => permissions.includes('export_data') || permissions.includes('export_csv') || permissions.includes('export_pdf') || permissions.includes('view_audit_log') },
]

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
  'documents_pending',
]
const ARCHIVE_STATUSES = ['hired', 'rejected', 'withdrawn']

const EVENT_TYPE_CONFIG = {
  interview: {
    label: 'Interview',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  test: {
    label: 'Test',
    badgeClass: 'bg-purple-100 text-purple-800',
  },
}

function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00:00'}`)
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value * 100)}%`
}

function StatusPill({ status, metaMap }) {
  const meta = getStatusMeta(metaMap, status)
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function TabActionButton({ onClick, children, icon: Icon, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`workspace-action-button ${primary ? 'workspace-action-button--primary' : 'workspace-action-button--secondary'}`}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}

export default function RecruiterDashboard() {
  const navigate = useNavigate()
  const { dashboardTab } = useParams()
  const { user, profile, signOut } = useAuth()
  const {
    permissions = [],
    role = null,
    loading: permLoading,
  } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    needsReview: 0,
    inReview: 0,
    inProgress: 0,
    completed: 0,
  })
  const [searchRef, setSearchRef] = useState('')
  const [scheduledEvents, setScheduledEvents] = useState([])
  const [prospects, setProspects] = useState([])
  const [requirements, setRequirements] = useState([])
  const [junctions, setJunctions] = useState([])
  const [recentExports, setRecentExports] = useState([])
  const [lookupMaps, setLookupMaps] = useState({
    countries: {},
    ranks: {},
    vessel_types: {},
  })
  const [lastLoadedAt, setLastLoadedAt] = useState(null)
  const [prospectSearch, setProspectSearch] = useState('')
  const [requirementSearch, setRequirementSearch] = useState('')

  const visibleTabs = DASHBOARD_TABS.filter((tab) => tab.visible({ permissions, role }))
  const requestedTab = dashboardTab || 'operations'
  const requestedTabVisible = visibleTabs.some((tab) => tab.id === requestedTab)
  const activeTab = requestedTabVisible ? requestedTab : 'operations'
  const canExportCsv = permissions.includes('export_data') || permissions.includes('export_csv')
  const canExportPdf = permissions.includes('export_data') || permissions.includes('export_pdf')
  const canViewApplicationTokens = permissions.includes('view_applications')

  useEffect(() => {
    let cancelled = false

    const loadDashboardData = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          totalResult,
          needsReviewResult,
          inReviewResult,
          inProgressResult,
          completedResult,
          scheduledEventsResult,
          prospectsResult,
          requirementsResult,
          junctionsResult,
          countriesResult,
          ranksResult,
          vesselTypesResult,
          exportsResult,
        ] = await Promise.all([
          supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .not('submitted_at', 'is', null),
          supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('status', NEEDS_REVIEW_STATUSES)
            .not('submitted_at', 'is', null),
          supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('status', IN_REVIEW_STATUSES)
            .not('submitted_at', 'is', null),
          supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('status', PIPELINE_STATUSES)
            .not('submitted_at', 'is', null),
          supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('status', ARCHIVE_STATUSES)
            .not('submitted_at', 'is', null),
          supabase
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
            .gte('scheduled_date', new Date().toISOString().split('T')[0])
            .order('scheduled_date', { ascending: true })
            .order('scheduled_time', { ascending: true })
            .limit(25),
          supabase
            .from('prospects')
            .select('id, name, status, telephone, email, lead_source, exp_in_rank_months, previous_employer, is_first_time_at_sea, first_contacted_at, last_activity_at, archived_at, deleted_at, created_at, updated_at, nationality_id, rank_applied_for_id, vessel_type_id')
            .order('last_activity_at', { ascending: false })
            .limit(100),
          supabase
            .from('requirements')
            .select('id, req_id_display, req_year_month, date_opened, date_closed, vessel_name, status, positions_required, target_days, customer_name, owner_recruiter_id, created_by_recruiter_id, rank_id, vessel_type_id, closure_reason, version, updated_at, created_at')
            .order('updated_at', { ascending: false })
            .limit(100),
          supabase
            .from('prospect_requirements')
            .select('id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at, version')
            .order('updated_at', { ascending: false })
            .limit(120),
          supabase.from('countries').select('id, code, name').order('name'),
          supabase.from('ranks').select('id, code, name').order('name'),
          supabase.from('vessel_types').select('id, code, name').order('name'),
          supabase.rpc('get_recent_exports', { p_limit: 10 }),
        ])

        if (cancelled) return

        const pullCount = (result) => {
          if (result.error) throw result.error
          return result.count || 0
        }

        const pullRows = (result) => {
          if (result.error) throw result.error
          return result.data || []
        }

        setStats({
          total: pullCount(totalResult),
          needsReview: pullCount(needsReviewResult),
          inReview: pullCount(inReviewResult),
          inProgress: pullCount(inProgressResult),
          completed: pullCount(completedResult),
        })

        setScheduledEvents(pullRows(scheduledEventsResult))
        setProspects(pullRows(prospectsResult))
        setRequirements(pullRows(requirementsResult))
        setJunctions(pullRows(junctionsResult))
        setRecentExports(exportsResult.error ? [] : exportsResult.data || [])
        setLookupMaps({
          countries: buildLookupMap(pullRows(countriesResult)),
          ranks: buildLookupMap(pullRows(ranksResult)),
          vessel_types: buildLookupMap(pullRows(vesselTypesResult)),
        })
        setLastLoadedAt(new Date())
      } catch (loadError) {
        if (cancelled) return
        console.error('Error loading recruiter dashboard data:', loadError)
        setError(loadError?.message || 'Failed to load recruiter dashboard data')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (user && !permLoading) {
      loadDashboardData()
    }

    return () => {
      cancelled = true
    }
  }, [user, permLoading])

  const scheduleSnapshot = useMemo(() => {
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
  }, [scheduledEvents])

  const prospectCounts = useMemo(() => {
    const live = prospects.filter((prospect) => prospect.deleted_at == null && prospect.archived_at == null)
    return {
      total: prospects.length,
      live: live.length,
      open: live.filter((prospect) => prospect.status === 'open').length,
      contacted: live.filter((prospect) => prospect.status === 'contacted').length,
      approved: live.filter((prospect) => prospect.status === 'approved').length,
      rejected: prospects.filter((prospect) => prospect.status === 'rejected').length,
    }
  }, [prospects])

  const requirementCounts = useMemo(() => ({
    total: requirements.length,
    open: requirements.filter((requirement) => requirement.status === 'open').length,
    closed: requirements.filter((requirement) => requirement.status === 'closed').length,
    cancelled: requirements.filter((requirement) => requirement.status === 'cancelled').length,
  }), [requirements])

  const junctionCounts = useMemo(() => ({
    total: junctions.length,
    shortlisted: junctions.filter((junction) => junction.status === 'shortlisted').length,
    submitted_to_customer: junctions.filter((junction) => junction.status === 'submitted_to_customer').length,
    customer_reviewing: junctions.filter((junction) => junction.status === 'customer_reviewing').length,
    customer_accepted: junctions.filter((junction) => junction.status === 'customer_accepted').length,
    customer_rejected: junctions.filter((junction) => junction.status === 'customer_rejected').length,
    joined: junctions.filter((junction) => junction.status === 'joined').length,
    withdrawn: junctions.filter((junction) => junction.status === 'withdrawn').length,
  }), [junctions])

  const filteredProspects = useMemo(() => {
    const term = prospectSearch.trim().toLowerCase()
    if (!term) return prospects

    return prospects.filter((prospect) => {
      const haystack = [
        prospect.name,
        prospect.email,
        prospect.telephone,
        prospect.lead_source,
        getLookupName(lookupMaps.ranks, prospect.rank_applied_for_id, ''),
        getLookupName(lookupMaps.countries, prospect.nationality_id, ''),
        getLookupName(lookupMaps.vessel_types, prospect.vessel_type_id, ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [prospects, prospectSearch, lookupMaps])

  const filteredRequirements = useMemo(() => {
    const term = requirementSearch.trim().toLowerCase()
    if (!term) return requirements

    return requirements.filter((requirement) => {
      const haystack = [
        requirement.req_id_display,
        requirement.customer_name,
        requirement.vessel_name,
        getLookupName(lookupMaps.ranks, requirement.rank_id, ''),
        getLookupName(lookupMaps.vessel_types, requirement.vessel_type_id, ''),
        requirement.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [requirements, requirementSearch, lookupMaps])

  const funnelStages = [
    { key: 'open-prospects', label: 'Open prospects', count: prospectCounts.open, hint: 'New leads waiting for first outreach.' },
    { key: 'contacted-prospects', label: 'Contacted prospects', count: prospectCounts.contacted, hint: 'Follow up until the prospect is ready to move.' },
    { key: 'approved-prospects', label: 'Approved prospects', count: prospectCounts.approved, hint: 'Ready for requirement matching.' },
    { key: 'shortlisted', label: 'Shortlisted', count: junctionCounts.shortlisted, hint: 'Prospects attached to a requirement.' },
    { key: 'submitted', label: 'Submitted', count: junctionCounts.submitted_to_customer, hint: 'Sent to the customer for review.' },
    { key: 'accepted', label: 'Accepted', count: junctionCounts.customer_accepted, hint: 'Ready to close into a placement.' },
    { key: 'joined', label: 'Joined', count: junctionCounts.joined, hint: 'Placed and onboarded.' },
  ]

  const kpiRows = [
    { label: 'Live prospects', value: prospectCounts.live, hint: 'Active prospect records in the pipeline.' },
    { label: 'Open requirements', value: requirementCounts.open, hint: 'Requirements ready for matching.' },
    { label: 'Active junctions', value: junctionCounts.total, hint: 'Prospect to requirement links under management.' },
    { label: 'Joined outcomes', value: junctionCounts.joined, hint: 'Placements that reached joined status.' },
    { label: 'Applications in review', value: stats.inReview, hint: 'Live recruiter review queue.' },
    { label: 'Upcoming events', value: scheduleSnapshot.pending, hint: 'Tests and interviews on the calendar.' },
  ]

  const reportRows = [
    { label: 'Applications by stage', value: `${stats.needsReview} new · ${stats.inReview} in review · ${stats.inProgress} in pipeline`, hint: 'Use the applications workspace for the detailed queue.' },
    { label: 'Prospects by status', value: `${prospectCounts.open} open · ${prospectCounts.contacted} contacted · ${prospectCounts.approved} approved`, hint: 'Keep the prospect side moving toward matching.' },
    { label: 'Requirements by status', value: `${requirementCounts.open} open · ${requirementCounts.closed} closed · ${requirementCounts.cancelled} cancelled`, hint: 'The live requirement pool drives matching demand.' },
    { label: 'Junction outcomes', value: `${junctionCounts.shortlisted} shortlisted · ${junctionCounts.submitted_to_customer} submitted · ${junctionCounts.joined} joined`, hint: 'This is the placement pipeline progression.' },
  ]

  const refreshRecentExports = async () => {
    const { data, error } = await supabase.rpc('get_recent_exports', { p_limit: 10 })
    if (!error) {
      setRecentExports(data || [])
    }
  }

  const exportProspectsCsv = async () => {
    const rows = filteredProspects.map((prospect) => ({
      id: prospect.id,
      name: prospect.name,
      status: prospect.status,
      email: prospect.email,
      telephone: prospect.telephone,
      rank: getLookupName(lookupMaps.ranks, prospect.rank_applied_for_id, 'Unknown rank'),
      vessel_type: getLookupName(lookupMaps.vessel_types, prospect.vessel_type_id, 'Unknown vessel'),
      nationality: getLookupName(lookupMaps.countries, prospect.nationality_id, 'Unknown nationality'),
      last_activity_at: formatDateTime(prospect.last_activity_at),
    }))

    try {
      await logRecruiterExport({
        reportType: 'prospect_queue',
        exportFormat: 'csv',
        rowIds: rows.map((row) => row.id),
        rowCount: rows.length,
        filters: { dashboardTab: 'prospects', search: prospectSearch },
        sort: { field: 'last_activity_at', direction: 'desc' },
      })
      await downloadCsvReport({
        filename: 'prospect-queue',
        columns: [
          { label: 'Name', value: (row) => row.name },
          { label: 'Status', value: (row) => row.status },
          { label: 'Email', value: (row) => row.email },
          { label: 'Phone', value: (row) => row.telephone },
          { label: 'Rank', value: (row) => row.rank },
          { label: 'Vessel type', value: (row) => row.vessel_type },
          { label: 'Nationality', value: (row) => row.nationality },
          { label: 'Last activity', value: (row) => row.last_activity_at },
        ],
        rows,
      })
      await refreshRecentExports()
    } catch (exportError) {
      console.error('Failed to log prospect export:', exportError)
      window.alert('Unable to export prospects CSV right now.')
    }
  }

  const exportRequirementsPdf = async () => {
    const rows = filteredRequirements.map((requirement) => ({
      id: requirement.id,
      display_id: requirement.req_id_display,
      customer: requirement.customer_name || 'Not provided',
      status: requirement.status,
      rank: getLookupName(lookupMaps.ranks, requirement.rank_id, 'Unknown rank'),
      vessel_type: getLookupName(lookupMaps.vessel_types, requirement.vessel_type_id, 'Unknown vessel'),
      positions_required: requirement.positions_required,
      target_days: requirement.target_days,
      closure_reason: requirement.closure_reason || 'Not set',
    }))

    try {
      await logRecruiterExport({
        reportType: 'requirement_tracker',
        exportFormat: 'pdf',
        rowIds: rows.map((row) => row.id),
        rowCount: rows.length,
        filters: { dashboardTab: 'requirements', search: requirementSearch },
        sort: { field: 'updated_at', direction: 'desc' },
      })
      await downloadPdfReport({
        filename: 'requirement-tracker',
        title: 'Requirements Tracker',
        subtitle: 'Live requirement queue for the current recruiter pipeline.',
        summaryItems: [
          { label: 'Open requirements', value: requirementCounts.open },
          { label: 'Closed requirements', value: requirementCounts.closed },
          { label: 'Cancelled requirements', value: requirementCounts.cancelled },
        ],
        tables: [
          {
            title: 'Requirement queue',
            headers: ['Requirement', 'Customer', 'Status', 'Rank', 'Vessel type', 'Positions', 'Target days', 'Closure reason'],
            rows: rows.slice(0, 20).map((row) => [
              row.display_id,
              row.customer,
              row.status,
              row.rank,
              row.vessel_type,
              String(row.positions_required),
              String(row.target_days),
              row.closure_reason,
            ]),
          },
        ],
        footerNote: 'Generated from the live recruiter workspace.',
      })
      await refreshRecentExports()
    } catch (exportError) {
      console.error('Failed to log requirement export:', exportError)
      window.alert('Unable to export requirements PDF right now.')
    }
  }

  const exportFunnelPdf = async () => {
    const rows = junctions.map((junction) => ({
      id: junction.id,
      prospect_name: (prospects.find((prospect) => prospect.id === junction.prospect_id) || {}).name || junction.prospect_id,
      requirement_name: (requirements.find((requirement) => requirement.id === junction.requirement_id) || {}).req_id_display || junction.requirement_id,
      status: junction.status,
      updated_at: formatDateTime(junction.updated_at),
    }))

    try {
      await logRecruiterExport({
        reportType: 'funnel_tracker',
        exportFormat: 'pdf',
        rowIds: rows.map((row) => row.id),
        rowCount: rows.length,
        filters: { dashboardTab: 'funnel' },
        sort: { field: 'updated_at', direction: 'desc' },
      })
      await downloadPdfReport({
        filename: 'candidates-funnel',
        title: 'Candidates Funnel Tracker',
        subtitle: 'Pipeline flow from prospect to joined placement.',
        summaryItems: [
          { label: 'Live prospects', value: prospectCounts.live },
          { label: 'Shortlisted', value: junctionCounts.shortlisted },
          { label: 'Joined', value: junctionCounts.joined },
        ],
        tables: [
          {
            title: 'Current funnel links',
            headers: ['Prospect', 'Requirement', 'Status', 'Updated'],
            rows: rows.slice(0, 20).map((row) => [row.prospect_name, row.requirement_name, row.status, row.updated_at]),
          },
        ],
        footerNote: 'Generated from the live recruiter workspace.',
      })
      await refreshRecentExports()
    } catch (exportError) {
      console.error('Failed to log funnel export:', exportError)
      window.alert('Unable to export funnel PDF right now.')
    }
  }

  const navigateToTab = (tabId) => navigate(`/recruiter/dashboard/${tabId}`)

  const handleSearchByRef = async (event) => {
    event.preventDefault()
    const ref = searchRef.trim()
    if (!ref) return

    try {
      if (!canViewApplicationTokens) {
        window.alert('Application access is required to open application records from the dashboard.')
        return
      }

      const { data, error: refError } = await supabase
        .from('applications')
        .select('public_token')
        .eq('reference_number', ref)
        .single()

      if (refError || !data) {
        window.alert(`Application not found with reference number: ${ref}`)
        return
      }

      navigate(`/application/view/${data.public_token}`)
    } catch (searchError) {
      console.error('Error searching application by reference:', searchError)
      window.alert('Application not found')
    }
  }

  if (dashboardTab && !DASHBOARD_TABS.some((tab) => tab.id === dashboardTab)) {
    return <Navigate to="/recruiter/dashboard/operations" replace />
  }

  if (dashboardTab && !requestedTabVisible) {
    return <Navigate to="/recruiter/dashboard/operations" replace />
  }

  if (permLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={FileBarChart2}
            title="Recruiter dashboard could not load"
            description={error}
            action={
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="workspace-action-button workspace-action-button--primary"
              >
                Retry
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const pageActions = (
    <div className="flex flex-wrap items-center gap-3">
      {activeTab === 'operations' ? (
        <>
          <TabActionButton icon={BriefcaseBusiness} onClick={() => navigate('/recruiter/applications')} primary>
            Open applications workspace
          </TabActionButton>
          <TabActionButton icon={UsersRound} onClick={() => navigate('/recruiter/prospects')}>
            Open prospect enrollment
          </TabActionButton>
        </>
      ) : activeTab === 'prospects' ? (
        <>
          <TabActionButton icon={UsersRound} onClick={() => navigate('/recruiter/prospects')} primary>
            Prospect enrollment
          </TabActionButton>
          <TabActionButton icon={ArrowRight} onClick={() => navigate('/recruiter/dashboard/requirements')}>
            Jump to requirements
          </TabActionButton>
        </>
      ) : activeTab === 'requirements' ? (
        <>
          <TabActionButton icon={FileText} onClick={() => navigate('/recruiter/prospects')} primary>
            Open enrollment workspace
          </TabActionButton>
          <TabActionButton icon={ArrowRight} onClick={() => navigate('/recruiter/dashboard/funnel')}>
            View funnel
          </TabActionButton>
        </>
      ) : activeTab === 'funnel' ? (
        <>
          <TabActionButton icon={Layers3} onClick={() => navigate('/recruiter/prospects')} primary>
            Review prospect pipeline
          </TabActionButton>
          <TabActionButton icon={Calendar} onClick={() => navigate('/recruiter/calendar')}>
            Open calendar
          </TabActionButton>
        </>
      ) : activeTab === 'kpi' ? (
        <>
          <TabActionButton icon={BarChart2} onClick={() => navigate('/recruiter/applications')} primary>
            Open applications workspace
          </TabActionButton>
          <TabActionButton icon={Calendar} onClick={() => navigate('/recruiter/calendar')}>
            Calendar
          </TabActionButton>
        </>
      ) : (
        <>
          <TabActionButton icon={FileBarChart2} onClick={() => navigate('/recruiter/applications')} primary>
            Open applications workspace
          </TabActionButton>
          <TabActionButton icon={Users} onClick={() => navigate('/recruiter/team')}>
            Team
          </TabActionButton>
        </>
      )}
    </div>
  )

  const renderOperationsTab = () => (
    <div className="space-y-6">
      <div className="workspace-kpi-grid">
        <StatCard label="New Submissions" value={stats.needsReview} icon={Clock} tone="warning" hint="Fresh applications that have not been triaged yet." />
        <StatCard label="In Review" value={stats.inReview} icon={Search} tone="accent" hint="Applications actively being assessed." />
        <StatCard label="Pipeline Active" value={stats.inProgress} icon={TrendingUp} tone="accent" hint="Testing, interviews, offers, or document follow-up." />
        <StatCard label="Completed" value={stats.completed} icon={ListChecks} tone="success" hint="Hired, rejected, or withdrawn outcomes." />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="recruiter-panel p-6">
          <div className="workspace-hero">
            <p className="workspace-hero__eyebrow">Queue Focus</p>
            <h2 className="workspace-hero__title">Work the newest submissions first, then move candidates into the wider pipeline.</h2>
            <p className="workspace-hero__description">
              The dashboard keeps the day-to-day recruiter view in one place while the applications workspace handles the heavy triage.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <TabActionButton icon={BriefcaseBusiness} onClick={() => navigate('/recruiter/applications')} primary>
                Open applications workspace
              </TabActionButton>
              <TabActionButton icon={UsersRound} onClick={() => navigate('/recruiter/prospects')}>
                Prospect enrollment
              </TabActionButton>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pipeline shortcuts</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Applications workspace', hint: 'Triage submissions and review compliance.', action: () => navigate('/recruiter/applications') },
                { label: 'Prospect enrollment', hint: 'Create prospects and match them to requirements.', action: () => navigate('/recruiter/prospects') },
                { label: 'Calendar', hint: 'Keep interviews and tests moving.', action: () => navigate('/recruiter/calendar') },
                { label: 'Team', hint: 'Check recruiter roles and access.', action: () => navigate('/recruiter/team') },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-teal-300 hover:shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.hint}</p>
                </button>
              ))}
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
                onChange={(event) => setSearchRef(event.target.value)}
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
            {lastLoadedAt ? (
              <span className="text-sm text-slate-500">
                Last synced {lastLoadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => window.location.reload()}
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
          {scheduleSnapshot.upcoming.length === 0 ? (
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

                return (
                  <div key={event.id} className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${config.badgeClass}`}>
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
                        <ListChecks className="h-4 w-4 text-slate-400" />
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
    </div>
  )

  const renderProspectsTab = () => (
    <div className="space-y-6">
      <div className="workspace-kpi-grid">
        <StatCard label="Prospects" value={prospectCounts.total} icon={Users} tone="info" hint="Visible prospect records in the latest workspace slice." />
        <StatCard label="Live prospects" value={prospectCounts.live} icon={TrendingUp} tone="success" hint="Open, contacted, or approved prospects still in play." />
        <StatCard label="Contacted" value={prospectCounts.contacted} icon={Search} tone="accent" hint="Prospects that need follow-up or qualification." />
        <StatCard label="Approved" value={prospectCounts.approved} icon={ListChecks} tone="success" hint="Prospects ready to be matched to requirements." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <div className="recruiter-panel overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Prospect Queue</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Latest prospects flowing through the pipeline</h2>
              </div>
              <input
                type="search"
                value={prospectSearch}
                onChange={(event) => setProspectSearch(event.target.value)}
                placeholder="Search prospect name, email, rank, vessel, or nationality"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200 lg:w-96"
              />
            </div>
          </div>

          <div className="divide-y">
            {filteredProspects.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Users}
                  title="No prospects match the current filter"
                  description="Try a different search term or go to the prospect enrollment workspace to create or attach a prospect."
                  action={
                    <button
                      type="button"
                      onClick={() => navigate('/recruiter/prospects')}
                      className="workspace-action-button workspace-action-button--primary"
                    >
                      Open prospect enrollment
                    </button>
                  }
                />
              </div>
            ) : (
              filteredProspects.map((prospect) => {
                const isArchived = prospect.archived_at != null || prospect.deleted_at != null
                const nationality = getLookupName(lookupMaps.countries, prospect.nationality_id, 'Unknown nationality')
                const rankName = getLookupName(lookupMaps.ranks, prospect.rank_applied_for_id, 'Unknown rank')
                const vesselName = getLookupName(lookupMaps.vessel_types, prospect.vessel_type_id, 'Unknown vessel')

                return (
                  <div key={prospect.id} className="p-6 transition-colors hover:bg-gray-50/70">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">{prospect.name}</h3>
                          <StatusPill status={prospect.status} metaMap={PROSPECT_STATUS_META} />
                          {isArchived ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-600">
                              Archived
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <p className="text-gray-500">Applied rank</p>
                            <p className="font-medium text-gray-900">{formatDisplayValue(rankName)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vessel type</p>
                            <p className="font-medium text-gray-900">{formatDisplayValue(vesselName)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Nationality</p>
                            <p className="font-medium text-gray-900">{nationality}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Experience</p>
                            <p className="font-medium text-gray-900">{prospect.exp_in_rank_months} month{prospect.exp_in_rank_months === 1 ? '' : 's'}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-gray-600 md:grid-cols-2">
                          <div>
                            <span className="font-medium text-gray-700">Contact:</span> {prospect.email} · {prospect.telephone}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Lead source:</span> {prospect.lead_source || 'Not provided'}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Last activity:</span> {formatRelativeTime(prospect.last_activity_at)}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Created:</span> {formatDateTime(prospect.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:ml-6">
                        <button
                          type="button"
                          onClick={() => navigate(`/recruiter/dashboard/prospects/${prospect.id}`)}
                          className="workspace-action-button workspace-action-button--secondary"
                        >
                          Open profile
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="recruiter-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Prospect posture</p>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Open', value: prospectCounts.open, note: 'Fresh prospects needing outreach.' },
                { label: 'Contacted', value: prospectCounts.contacted, note: 'Keep follow-up momentum moving.' },
                { label: 'Approved', value: prospectCounts.approved, note: 'Ready for requirement matching.' },
                { label: 'Rejected', value: prospectCounts.rejected, note: 'No longer active in the live pool.' },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="text-xl font-semibold text-slate-950">{row.value}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{row.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="recruiter-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Fast path</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Move a prospect through the pipeline</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create or attach prospects in the enrollment workspace, then inspect the detail page for notes, requirements, and linked applications.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => navigate('/recruiter/prospects')}
                className="workspace-action-button workspace-action-button--primary w-full justify-center"
              >
                Open prospect enrollment
              </button>
              <button
                type="button"
                onClick={() => navigate('/recruiter/dashboard/requirements')}
                className="workspace-action-button workspace-action-button--secondary w-full justify-center"
              >
                Review requirements
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderRequirementsTab = () => (
    <div className="space-y-6">
      <div className="workspace-kpi-grid">
        <StatCard label="Requirements" value={requirementCounts.total} icon={FileText} tone="info" hint="Latest requirements visible in the live workspace slice." />
        <StatCard label="Open requirements" value={requirementCounts.open} icon={TrendingUp} tone="success" hint="The live demand pool for matching and shortlisting." />
        <StatCard label="Closed" value={requirementCounts.closed} icon={ListChecks} tone="default" hint="Completed requirements." />
        <StatCard label="Cancelled" value={requirementCounts.cancelled} icon={Clock} tone="warning" hint="Cancelled requirements with a closure reason." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <div className="recruiter-panel overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Requirement Queue</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Open requirements and their current pipeline state</h2>
              </div>
              <input
                type="search"
                value={requirementSearch}
                onChange={(event) => setRequirementSearch(event.target.value)}
                placeholder="Search requirement ID, customer, rank, vessel, or status"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200 lg:w-96"
              />
            </div>
          </div>

          <div className="divide-y">
            {filteredRequirements.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={FileText}
                  title="No requirements match the current filter"
                  description="Try a different search term or switch to the prospect enrollment workspace to create or attach a prospect against a requirement."
                  action={
                    <button
                      type="button"
                      onClick={() => navigate('/recruiter/prospects')}
                      className="workspace-action-button workspace-action-button--primary"
                    >
                      Open prospect enrollment
                    </button>
                  }
                />
              </div>
            ) : (
              filteredRequirements.map((requirement) => {
                const rankName = getLookupName(lookupMaps.ranks, requirement.rank_id, 'Unknown rank')
                const vesselName = getLookupName(lookupMaps.vessel_types, requirement.vessel_type_id, 'Unknown vessel')

                return (
                  <div key={requirement.id} className="p-6 transition-colors hover:bg-gray-50/70">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900 tracking-tight">{requirement.req_id_display}</h3>
                          <StatusPill status={requirement.status} metaMap={REQUIREMENT_STATUS_META} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <p className="text-gray-500">Customer</p>
                            <p className="font-medium text-gray-900">{requirement.customer_name || 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Rank</p>
                            <p className="font-medium text-gray-900">{formatDisplayValue(rankName)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vessel type</p>
                            <p className="font-medium text-gray-900">{formatDisplayValue(vesselName)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Positions</p>
                            <p className="font-medium text-gray-900">{requirement.positions_required}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-gray-600 md:grid-cols-2">
                          <div>
                            <span className="font-medium text-gray-700">Opened:</span> {formatDate(requirement.date_opened)}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Target days:</span> {requirement.target_days}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Last updated:</span> {formatRelativeTime(requirement.updated_at)}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Closure reason:</span> {requirement.closure_reason || 'Not set'}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:ml-6">
                        <button
                          type="button"
                          onClick={() => navigate(`/recruiter/dashboard/requirements/${requirement.id}`)}
                          className="workspace-action-button workspace-action-button--secondary"
                        >
                          Open requirement
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="recruiter-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Requirement posture</p>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Open', value: requirementCounts.open, note: 'Live demand ready for matching.' },
                { label: 'Closed', value: requirementCounts.closed, note: 'Requirements already resolved.' },
                { label: 'Cancelled', value: requirementCounts.cancelled, note: 'Cancelled requirements with closure details.' },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="text-xl font-semibold text-slate-950">{row.value}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{row.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="recruiter-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Fast path</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Use requirements to guide the pipeline</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Requirements are the demand side of the funnel. Open a requirement to see linked prospects, remarks, and matching progress.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => navigate('/recruiter/dashboard/funnel')}
                className="workspace-action-button workspace-action-button--primary w-full justify-center"
              >
                Review funnel
              </button>
              <button
                type="button"
                onClick={() => navigate('/recruiter/prospects')}
                className="workspace-action-button workspace-action-button--secondary w-full justify-center"
              >
                Open enrollment workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderFunnelTab = () => (
    <div className="space-y-6">
      <div className="workspace-kpi-grid">
        <StatCard label="Live prospects" value={prospectCounts.live} icon={Users} tone="info" hint="Prospects still eligible to be worked." />
        <StatCard label="Shortlisted" value={junctionCounts.shortlisted} icon={ListChecks} tone="accent" hint="Prospects attached to requirements." />
        <StatCard label="Submitted" value={junctionCounts.submitted_to_customer} icon={ArrowRight} tone="accent" hint="Prospects already in front of the customer." />
        <StatCard label="Joined" value={junctionCounts.joined} icon={TrendingUp} tone="success" hint="Placement outcomes that have closed the loop." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <div className="recruiter-panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Pipeline stages</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Follow the pipeline from prospect to joined placement.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            The funnel view keeps the recruiting flow readable from left to right: create the prospect, match it to a requirement, push it to customer review, and close it into a joined placement.
          </p>

          <div className="mt-6 grid gap-4">
            {funnelStages.map((stage, index) => (
              <div key={stage.key} className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stage {index + 1}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">{stage.label}</h3>
                    <p className="mt-1 text-sm text-slate-600">{stage.hint}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-3xl font-semibold text-slate-950">{stage.count}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">records</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="recruiter-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Pipeline health</p>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Open prospects', value: prospectCounts.open, note: 'Leads still needing outreach.' },
                { label: 'Open requirements', value: requirementCounts.open, note: 'Demand ready to receive shortlisted prospects.' },
                { label: 'Customer reviewing', value: junctionCounts.customer_reviewing, note: 'Placement conversations currently with the customer.' },
                { label: 'Withdrawn', value: junctionCounts.withdrawn, note: 'Withdrawn placements to review for root cause.' },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="text-xl font-semibold text-slate-950">{row.value}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{row.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="recruiter-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Fast path</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">What to do next</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep the flow moving by matching approved prospects to open requirements, then pushing shortlisted prospects through customer review.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => navigate('/recruiter/prospects')}
                className="workspace-action-button workspace-action-button--primary w-full justify-center"
              >
                Open prospect enrollment
              </button>
              <button
                type="button"
                onClick={() => navigate('/recruiter/applications')}
                className="workspace-action-button workspace-action-button--secondary w-full justify-center"
              >
                Review applications queue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const prospectToMatchRate = prospectCounts.live > 0 ? junctionCounts.shortlisted / prospectCounts.live : 0
  const matchToJoinRate = junctionCounts.total > 0 ? junctionCounts.joined / junctionCounts.total : 0
  const openRequirementCoverage = requirementCounts.open > 0 ? junctionCounts.shortlisted / requirementCounts.open : 0

  const renderKpiTab = () => (
    <div className="space-y-6">
      <div className="workspace-kpi-grid">
        {kpiRows.map((row) => (
          <StatCard key={row.label} label={row.label} value={row.value} icon={TrendingUp} tone="accent" hint={row.hint} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <div className="recruiter-panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Operating ratios</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Read the pipeline at a glance</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            These are the recruiter-friendly ratios that show whether prospects are moving, requirements are filling, and placements are closing.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Prospect to match', value: formatPercent(prospectToMatchRate), note: 'Shortlisted prospects out of live prospects.' },
              { label: 'Match to join', value: formatPercent(matchToJoinRate), note: 'Joined placements out of the live match pool.' },
              { label: 'Requirement coverage', value: formatPercent(openRequirementCoverage), note: 'Shortlisted matches against open requirements.' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{metric.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="recruiter-panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Next attention</p>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Review applications', value: stats.needsReview, note: 'Fresh submissions waiting for triage.' },
              { label: 'Check open requirements', value: requirementCounts.open, note: 'The demand side of the funnel.' },
              { label: 'Follow up contacted prospects', value: prospectCounts.contacted, note: 'Move them toward approval.' },
              { label: 'Inspect customer review', value: junctionCounts.customer_reviewing, note: 'Prospects currently awaiting decision.' },
            ].map((row) => (
              <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="text-xl font-semibold text-slate-950">{row.value}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="workspace-kpi-grid">
        <StatCard label="Applications" value={stats.total} icon={FileBarChart2} tone="info" hint="Submitted applications in the live recruiter pool." />
        <StatCard label="Prospects" value={prospectCounts.total} icon={Users} tone="accent" hint="Current prospect records available for reporting." />
        <StatCard label="Requirements" value={requirementCounts.total} icon={FileText} tone="accent" hint="Live requirement records available for reporting." />
        <StatCard label="Joined" value={junctionCounts.joined} icon={ListChecks} tone="success" hint="Placed prospects that completed the funnel." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <div className="recruiter-panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Report-ready snapshots</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Use the current pipeline state as the basis for reports.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This surface keeps the reporting story compact and operational: summarize the current queue, then drill into prospects or requirements when a deeper read is needed.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {canExportCsv ? (
              <button
                type="button"
                onClick={exportProspectsCsv}
                className="workspace-action-button workspace-action-button--primary"
              >
                Export prospects CSV
              </button>
            ) : null}
            {canExportPdf ? (
              <button
                type="button"
                onClick={exportRequirementsPdf}
                className="workspace-action-button workspace-action-button--secondary"
              >
                Export requirements PDF
              </button>
            ) : null}
            {canExportPdf ? (
              <button
                type="button"
                onClick={exportFunnelPdf}
                className="workspace-action-button workspace-action-button--secondary"
              >
                Export funnel PDF
              </button>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {reportRows.map((row) => (
              <div key={row.label} className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{row.label}</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{row.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{row.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="recruiter-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Latest snapshot</p>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Last loaded', value: lastLoadedAt ? formatDateTime(lastLoadedAt) : 'Not loaded yet', note: 'Dashboard data refresh timestamp.' },
                { label: 'Upcoming events', value: scheduleSnapshot.pending, note: 'Tests and interviews already on the calendar.' },
                { label: 'Pipeline stages', value: funnelStages.length, note: 'The current number of visible funnel steps.' },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{row.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{row.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="recruiter-panel p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Recent exports</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">Audit trail of what the team exported</h3>
              </div>
              <button
                type="button"
                onClick={refreshRecentExports}
                className="workspace-action-button workspace-action-button--secondary"
              >
                Refresh
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {recentExports.length === 0 ? (
                <EmptyState
                  icon={FileBarChart2}
                  title="No exports yet"
                  description="Export activity will appear here once the team starts downloading reports."
                />
              ) : (
                recentExports.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.event_type}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                          {entry.actor_name || 'System'} · {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {entry.payload?.export_format || 'export'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {entry.payload?.report_type || 'report'} · {entry.payload?.row_count || 0} rows
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const tabContent = {
    operations: renderOperationsTab(),
    prospects: renderProspectsTab(),
    requirements: renderRequirementsTab(),
    funnel: renderFunnelTab(),
    kpi: renderKpiTab(),
    reports: renderReportsTab(),
  }[activeTab]

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Recruiter Dashboard"
            title="Pipeline command center"
            description={
              activeTab === 'operations'
                ? 'Use the dashboard to keep the daily triage queue, prospect flow, requirement demand, and reporting view in one place.'
                : activeTab === 'prospects'
                  ? 'Work the lead side of the pipeline, from first contact to approval.'
                  : activeTab === 'requirements'
                    ? 'Track live demand and keep requirements moving from open to closed.'
                    : activeTab === 'funnel'
                      ? 'See the recruiter pipeline in the order it actually moves.'
                      : activeTab === 'kpi'
                        ? 'Read the pipeline through recruiter-friendly operating numbers.'
                        : 'Keep a compact report-ready view of the current recruiter pipeline.'
            }
            actions={pageActions}
          >
            <div className="mt-5">
              <SegmentedControl
                options={visibleTabs.map((tab) => ({
                  value: tab.id,
                  label: tab.label,
                  icon: tab.icon,
                }))}
                value={activeTab}
                onChange={navigateToTab}
              />
            </div>
          </PageHeader>

          {tabContent}
        </div>
      </div>
    </div>
  )
}
