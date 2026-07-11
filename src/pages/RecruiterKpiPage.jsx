import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import useKpiTrackerData from '../hooks/useKpiTrackerData'
import {
  buildCandidateFunnelRows,
  buildRequirementTrackerRows,
  computeDashboardMetrics,
  formatDays,
  formatPercent,
  FUNNEL_STAGES,
  ON_TIME_BADGE_CLASSES,
  STAGE_BADGE_CLASSES,
} from '../utils/kpiTracker'
import { formatDateTime, formatDate } from './recruiterDashboardUtils'
import { downloadCsvReport, downloadPdfReport, logRecruiterExport } from '../services/recruiterReportExportService'
import SegmentedControl from '../components/ui/SegmentedControl'
import { HBarChart, TrendChart, ColumnChart, ChartLegend } from '../components/charts/SimpleCharts'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileBarChart2,
  Hourglass,
  LayoutDashboard,
  Layers3,
  Loader2,
  PhoneCall,
  RefreshCcw,
  Ship,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'

const KPI_TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'charts', label: 'Charts', icon: BarChart3 },
  { value: 'reports', label: 'Reports', icon: FileBarChart2 },
]

const DAY_MS = 24 * 60 * 60 * 1000

function TargetPill({ ok, children }) {
  return (
    <span className={`tracker-pill ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
      {children}
    </span>
  )
}

export default function RecruiterKpiPage() {
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const { role, loading: permLoading, canExportData, canViewAnalytics } = usePermissions()
  const hasKpiAccess = role === 'Master Recruiter' || canViewAnalytics()
  const tracker = useKpiTrackerData({ enabled: !permLoading && hasKpiAccess })
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [kpiTab, setKpiTab] = useState('overview')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const requirementRows = useMemo(() => buildRequirementTrackerRows(tracker.data), [tracker.data])
  const candidateRows = useMemo(() => buildCandidateFunnelRows({
    ...tracker.data,
    notes: tracker.data.prospectNotes,
  }), [tracker.data])

  const scopedRequirements = useMemo(() => {
    if (!recruiterFilter) return requirementRows
    return requirementRows.filter((row) => row.owner_recruiter_id === recruiterFilter || row.created_by_recruiter_id === recruiterFilter)
  }, [requirementRows, recruiterFilter])

  const scopedCandidates = useMemo(() => {
    if (!recruiterFilter) return candidateRows
    return candidateRows.filter((row) => row.created_by_recruiter_id === recruiterFilter)
  }, [candidateRows, recruiterFilter])

  const metrics = useMemo(() => computeDashboardMetrics({
    requirementRows: scopedRequirements,
    candidateRows: scopedCandidates,
    applications: recruiterFilter
      ? tracker.data.applications.filter((application) => application.handling_recruiter_id === recruiterFilter)
      : tracker.data.applications,
    recruiters: recruiterFilter
      ? tracker.data.recruiters.filter((recruiter) => recruiter.id === recruiterFilter)
      : tracker.data.recruiters,
  }), [scopedRequirements, scopedCandidates, tracker.data.applications, tracker.data.recruiters, recruiterFilter])

  const maxStageCount = Math.max(1, ...FUNNEL_STAGES.map((stage) => metrics.stageCounts[stage] || 0))

  // "Needs action now" — the items a recruiter should clear before anything else.
  const actions = useMemo(() => {
    const nowMs = Date.now()
    const todayStr = new Date().toISOString().slice(0, 10)
    const openReqs = scopedRequirements.filter((row) => row.status === 'open' && !row.isArchived)
    const overdue = openReqs.filter((row) => row.onTimeStatus === 'Overdue')
      .sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0))
    const nearTarget = openReqs.filter((row) => row.onTimeStatus !== 'Overdue' && row.targetDays && row.daysOpen != null && row.daysOpen >= row.targetDays * 0.8)
      .sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0))
    const staleReview = tracker.data.applications.filter((application) => (
      application.submitted_at
      && ['submitted', 'new'].includes(application.status)
      && nowMs - new Date(application.submitted_at).getTime() > 7 * DAY_MS
    ))
    const unassigned = tracker.data.applications.filter((application) => (
      application.submitted_at
      && !['hired', 'rejected', 'withdrawn'].includes(application.status)
      && !application.handling_recruiter_id
    ))
    const unclaimedInvites = tracker.data.prospects.filter((prospect) => (
      prospect.invited_at
      && !prospect.claimed_at
      && !prospect.archived_at
      && !prospect.deleted_at
      && nowMs - new Date(prospect.invited_at).getTime() > 3 * DAY_MS
    ))
    const eventsToday = tracker.data.scheduledEvents.filter((event) => (
      event.scheduled_date === todayStr && event.status !== 'cancelled'
    ))
    const contractsEnding = tracker.data.applications.filter((application) => (
      application.status === 'hired'
      && application.contract_end_date
      && new Date(application.contract_end_date).getTime() - nowMs < 45 * DAY_MS
    ))
    const total = overdue.length + nearTarget.length + staleReview.length + unassigned.length + unclaimedInvites.length + contractsEnding.length
    return { overdue, nearTarget, staleReview, unassigned, unclaimedInvites, eventsToday, contractsEnding, total }
  }, [scopedRequirements, tracker.data.applications, tracker.data.prospects, tracker.data.scheduledEvents])

  // Average client response time: junction submitted -> customer decision.
  const clientResponseDays = useMemo(() => {
    const samples = tracker.data.junctions
      .filter((junction) => junction.submitted_at && junction.customer_decided_at)
      .map((junction) => (new Date(junction.customer_decided_at) - new Date(junction.submitted_at)) / DAY_MS)
      .filter((days) => Number.isFinite(days) && days >= 0)
    if (samples.length === 0) return null
    return samples.reduce((sum, value) => sum + value, 0) / samples.length
  }, [tracker.data.junctions])

  const charts = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1)
    const weeks = []
    for (let i = 7; i >= 0; i -= 1) {
      const start = new Date(monday)
      start.setDate(monday.getDate() - i * 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      weeks.push({ start, end, label: `${start.getDate()}/${start.getMonth() + 1}` })
    }
    const inWeek = (value, week) => {
      if (!value) return false
      const date = new Date(value)
      return date >= week.start && date < week.end
    }
    const contacts = weeks.map((week) => scopedCandidates.filter((row) => inWeek(row.contactedAt, week)).length)
    const joins = weeks.map((week) => scopedCandidates.filter((row) => row.hasJoined && inWeek(row.joinedAt, week)).length)

    const openReqs = scopedRequirements.filter((row) => row.status === 'open' && !row.isArchived)
    const buckets = { onTrack: 0, past50: 0, near: 0, overdue: 0 }
    openReqs.forEach((row) => {
      if (row.onTimeStatus === 'Overdue') buckets.overdue += 1
      else if (row.targetDays && row.daysOpen != null && row.daysOpen >= row.targetDays * 0.8) buckets.near += 1
      else if (row.targetDays && row.daysOpen != null && row.daysOpen >= row.targetDays * 0.5) buckets.past50 += 1
      else buckets.onTrack += 1
    })

    const demandMap = {}
    openReqs.forEach((row) => {
      demandMap[row.rankName] = (demandMap[row.rankName] || 0) + row.openPositions
    })
    const demandItems = Object.entries(demandMap)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value, color: '#2a78d6' }))

    const dwellMap = {}
    tracker.data.applications
      .filter((application) => application.submitted_at && !['hired', 'rejected', 'withdrawn'].includes(application.status))
      .forEach((application) => {
        const days = Math.max(0, Math.round((Date.now() - new Date(application.updated_at).getTime()) / DAY_MS))
        if (!dwellMap[application.status]) dwellMap[application.status] = []
        dwellMap[application.status].push(days)
      })
    const dwellItems = Object.entries(dwellMap)
      .map(([status, values]) => ({
        label: status.replaceAll('_', ' '),
        value: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        hint: `${values.length} app${values.length === 1 ? '' : 's'}`,
        color: '#7f77dd',
      }))
      .sort((a, b) => b.value - a.value)

    const funnelColors = ['#b5d4f4', '#85b7eb', '#5f9de2', '#378add', '#2a78d6', '#1d9e75', '#e24b4a', '#888780']
    const funnelItems = FUNNEL_STAGES.map((stage, index) => ({
      label: stage,
      value: metrics.stageCounts[stage] || 0,
      color: funnelColors[index],
    }))

    return { weekLabels: weeks.map((week) => week.label), contacts, joins, buckets, demandItems, dwellItems, funnelItems }
  }, [scopedCandidates, scopedRequirements, tracker.data.applications, metrics.stageCounts])

  const runReport = async (fn) => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await fn()
    } catch (error) {
      console.error('Report generation failed:', error)
      setExportError(error?.message || 'Report generation failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const generateWeeklyPdf = () => runReport(async () => {
    await logRecruiterExport({
      reportType: 'weekly_management_report',
      exportFormat: 'pdf',
      rowIds: scopedRequirements.map((row) => row.id),
      rowCount: scopedRequirements.length,
      filters: { recruiterFilter },
    })
    await downloadPdfReport({
      filename: `weekly-management-report-${new Date().toISOString().slice(0, 10)}`,
      title: 'Weekly management report',
      subtitle: `Generated ${formatDateTime(new Date().toISOString())} · Crew recruitment KPI tracker`,
      summaryItems: [
        { label: 'Open requirements', value: metrics.openRequirementsCount },
        { label: 'Closed requirements', value: metrics.closedRequirementsCount },
        { label: 'Open positions', value: metrics.openPositions },
        { label: 'Joined vs required', value: `${metrics.joinedAgainstRequirements} / ${metrics.positionsRequired}` },
        { label: 'Requirement closure % (target ≥95%)', value: formatPercent(metrics.closureRate) },
        { label: 'Contact-to-join conversion (target 8–12%)', value: formatPercent(metrics.conversionRate) },
        { label: 'Active pipeline', value: metrics.activePipelineCount },
        { label: 'Avg days to join', value: metrics.avgDaysToJoin == null ? '—' : formatDays(metrics.avgDaysToJoin) },
        { label: 'Needs action items', value: actions.total },
      ],
      tables: [
        {
          title: 'Open requirement ageing',
          headers: ['Req ID', 'Vessel', 'Rank', 'Open', 'Days open', 'Target', 'Status'],
          rows: metrics.requirementAgeing.slice(0, 15).map((row) => [
            row.reqId, row.vessel_name || '—', row.rankName, String(row.openPositions),
            String(row.daysOpen ?? '—'), String(row.targetDays ?? '—'), row.onTimeStatus,
          ]),
        },
        {
          title: 'Recruiter scorecard',
          headers: ['Recruiter', 'Contacted today', 'Touched', 'Joined', 'Conversion', 'Pipeline', 'Handling'],
          rows: metrics.scorecard.map((row) => [
            row.name, String(row.contactedToday), String(row.totalTouched), String(row.joined),
            formatPercent(row.conversionRate), String(row.activePipeline), String(row.handlingApplications),
          ]),
        },
      ],
      footerNote: 'Success = joined candidates only. Generated from the live NjordHR KPI tracker.',
    })
  })

  const generateClosureCsv = () => runReport(async () => {
    await logRecruiterExport({
      reportType: 'requirement_closure_report',
      exportFormat: 'csv',
      rowIds: scopedRequirements.map((row) => row.id),
      rowCount: scopedRequirements.length,
      filters: { recruiterFilter },
    })
    await downloadCsvReport({
      filename: `requirement-closure-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Req ID', value: (row) => row.reqId },
        { label: 'Customer', value: (row) => row.customer_name || '' },
        { label: 'Vessel', value: (row) => row.vessel_name || '' },
        { label: 'Rank', value: (row) => row.rankName },
        { label: 'Opened', value: (row) => row.date_opened || '' },
        { label: 'Closed', value: (row) => row.date_closed || '' },
        { label: 'Status', value: (row) => row.status },
        { label: 'Positions', value: (row) => row.positions_required },
        { label: 'Joined', value: (row) => row.joinedCount },
        { label: 'Days open', value: (row) => row.daysOpen ?? '' },
        { label: 'Days to close', value: (row) => row.daysToClose ?? '' },
        { label: 'Target days', value: (row) => row.targetDays ?? '' },
        { label: 'On-time', value: (row) => row.onTimeStatus },
        { label: 'Recruiter', value: (row) => row.recruiterName },
      ],
      rows: scopedRequirements,
    })
  })

  const generateProductivityCsv = () => runReport(async () => {
    await logRecruiterExport({
      reportType: 'recruiter_productivity_report',
      exportFormat: 'csv',
      rowIds: metrics.scorecard.map((row) => row.id),
      rowCount: metrics.scorecard.length,
      filters: { recruiterFilter },
    })
    await downloadCsvReport({
      filename: `recruiter-productivity-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Recruiter', value: (row) => row.name },
        { label: 'Role', value: (row) => row.roleName },
        { label: 'Contacted today', value: (row) => row.contactedToday },
        { label: 'Total touched', value: (row) => row.totalTouched },
        { label: 'Joined', value: (row) => row.joined },
        { label: 'Conversion %', value: (row) => Math.round(row.conversionRate * 100) },
        { label: 'Active pipeline', value: (row) => row.activePipeline },
        { label: 'Handling applications', value: (row) => row.handlingApplications },
      ],
      rows: metrics.scorecard,
    })
  })

  const generateFunnelCsv = () => runReport(async () => {
    const totalCandidates = FUNNEL_STAGES.reduce((sum, stage) => sum + (metrics.stageCounts[stage] || 0), 0)
    const rows = FUNNEL_STAGES.map((stage) => ({
      stage,
      count: metrics.stageCounts[stage] || 0,
      share: totalCandidates === 0 ? 0 : Math.round(((metrics.stageCounts[stage] || 0) / totalCandidates) * 100),
    }))
    await logRecruiterExport({
      reportType: 'funnel_dropoff_report',
      exportFormat: 'csv',
      rowIds: scopedCandidates.map((row) => row.id),
      rowCount: rows.length,
      filters: { recruiterFilter },
    })
    await downloadCsvReport({
      filename: `funnel-dropoff-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Stage', value: (row) => row.stage },
        { label: 'Candidates', value: (row) => row.count },
        { label: 'Share %', value: (row) => row.share },
      ],
      rows,
    })
  })

  const exportSummary = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await runExportSummary()
    } catch (error) {
      console.error('KPI summary export failed:', error)
      setExportError(error?.message || 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const runExportSummary = async () => {
    const summaryRows = [
      { metric: 'Open Requirements (#)', value: metrics.openRequirementsCount, target: '', comment: 'Approved positions still open' },
      { metric: 'Closed Requirements (#)', value: metrics.closedRequirementsCount, target: '', comment: 'All positions joined' },
      { metric: 'Open Positions', value: metrics.openPositions, target: '', comment: 'Balance positions to be closed' },
      { metric: 'Joined vs Required', value: `${metrics.joinedAgainstRequirements} / ${metrics.positionsRequired}`, target: '', comment: 'Delivery against approved demand' },
      { metric: 'Requirement Closure %', value: formatPercent(metrics.closureRate), target: '>=95%', comment: 'Closed requirements / total requirements' },
      { metric: 'Candidates Contacted Today', value: metrics.contactedTodayCount, target: '15-25 / recruiter', comment: 'Daily input metric' },
      { metric: 'Candidates Joined Today', value: metrics.joinedTodayCount, target: '', comment: 'Daily result metric' },
      { metric: 'Contact-to-Join Conversion %', value: formatPercent(metrics.conversionRate), target: '8-12%', comment: 'Joined / total candidates touched' },
      { metric: 'Active Pipeline', value: metrics.activePipelineCount, target: '', comment: 'Candidates still active' },
      { metric: 'Avg Days to Join', value: metrics.avgDaysToJoin == null ? '' : Math.round(metrics.avgDaysToJoin * 10) / 10, target: '', comment: 'Speed from contact to join' },
      ...FUNNEL_STAGES.map((stage) => ({ metric: `Pipeline: ${stage}`, value: metrics.stageCounts[stage] || 0, target: '', comment: 'Pipeline by stage' })),
    ]

    await logRecruiterExport({
      reportType: 'kpi_summary',
      exportFormat: 'csv',
      rowIds: [
        ...scopedRequirements.map((row) => row.id),
        ...scopedCandidates.map((row) => row.id),
      ],
      rowCount: scopedRequirements.length + scopedCandidates.length,
      filters: { recruiterFilter },
    })
    await downloadCsvReport({
      filename: `kpi-dashboard-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Metric', value: (row) => row.metric },
        { label: 'Value', value: (row) => row.value },
        { label: 'Target', value: (row) => row.target },
        { label: 'Comment', value: (row) => row.comment },
      ],
      rows: summaryRows,
    })
  }

  if (permLoading || (hasKpiAccess && tracker.loading)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  // Mirror the nav gate at page level so the org-wide dashboard (including the
  // per-recruiter scorecard) cannot be opened by direct URL without access.
  if (!hasKpiAccess) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <section className="recruiter-panel p-8">
            <EmptyState
              icon={Layers3}
              title="KPI analytics is restricted"
              description="Your account does not have analytics access. Ask a Master Recruiter if you need this dashboard."
            />
          </section>
        </main>
      </div>
    )
  }

  const closureOk = metrics.closureRate >= 0.95
  const conversionOk = metrics.conversionRate >= 0.08

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="KPI Dashboard"
          title="Recruitment live dashboard"
          description="Live management view — no manual update needed. Success = joined candidates only."
          actions={(
            <div className="flex flex-wrap gap-3">
              {canExportData() ? (
                <button
                  type="button"
                  onClick={exportSummary}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting…' : 'Export summary'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={tracker.reload}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          )}
        >
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">Recruiter</span>
              <select
                value={recruiterFilter}
                onChange={(event) => setRecruiterFilter(event.target.value)}
                className="w-56 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All recruiters</option>
                {tracker.data.recruiters.map((recruiter) => (
                  <option key={recruiter.id} value={recruiter.id}>
                    {recruiter.full_name || recruiter.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Report date:</span> {formatDateTime(new Date().toISOString())}
            </div>
          </div>
        </PageHeader>

        {exportError ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {exportError}
          </div>
        ) : null}

        {tracker.error ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
            <p className="font-semibold">Could not load the live dashboard.</p>
            <p className="mt-1">{tracker.error}</p>
            <button
              type="button"
              onClick={tracker.reload}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : (
        <>
        <div className="mt-6 max-w-full overflow-x-auto">
          <SegmentedControl options={KPI_TABS} value={kpiTab} onChange={setKpiTab} />
        </div>

        {kpiTab === 'overview' ? (
        <>
        {/* Needs action now */}
        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${actions.total > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Needs action now</h2>
              <p className="mt-1 text-sm text-slate-600">
                {actions.total > 0
                  ? `${actions.total} item${actions.total === 1 ? '' : 's'} waiting on a recruiter.`
                  : 'All clear — nothing is waiting on you right now.'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actions.overdue.slice(0, 3).map((row) => (
              <Link
                key={row.id}
                to={`/recruiter/workspace/requirements/${row.id}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="rounded-2xl border border-rose-200 bg-rose-50 p-4 transition hover:border-rose-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-rose-900">{row.reqId}</span>
                  <span className="tracker-pill bg-rose-100 text-rose-800">Overdue</span>
                </div>
                <p className="mt-1 text-sm text-rose-800">
                  {row.vessel_name || 'Vessel TBC'} · {row.rankName} · {row.daysOpen} days open (target {row.targetDays})
                </p>
              </Link>
            ))}
            {actions.nearTarget.slice(0, 3).map((row) => (
              <Link
                key={row.id}
                to={`/recruiter/workspace/requirements/${row.id}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-amber-900">{row.reqId}</span>
                  <span className="tracker-pill bg-amber-100 text-amber-800">Near target</span>
                </div>
                <p className="mt-1 text-sm text-amber-800">
                  {row.vessel_name || 'Vessel TBC'} · {row.rankName} · {row.daysOpen} of {row.targetDays} target days used
                </p>
              </Link>
            ))}
            {actions.staleReview.length > 0 ? (
              <Link to="/recruiter/applications" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300">
                <div className="font-semibold text-amber-900">{actions.staleReview.length} application{actions.staleReview.length === 1 ? '' : 's'} awaiting review</div>
                <p className="mt-1 text-sm text-amber-800">Submitted more than 7 days ago and still not in review.</p>
              </Link>
            ) : null}
            {actions.unassigned.length > 0 ? (
              <Link to="/recruiter/applications" className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
                <div className="font-semibold text-slate-900">{actions.unassigned.length} live application{actions.unassigned.length === 1 ? '' : 's'} unassigned</div>
                <p className="mt-1 text-sm text-slate-600">No handling recruiter set — assign them in the pipeline.</p>
              </Link>
            ) : null}
            {actions.unclaimedInvites.length > 0 ? (
              <Link to="/recruiter/workspace?tab=candidates" className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
                <div className="font-semibold text-slate-900">{actions.unclaimedInvites.length} invite{actions.unclaimedInvites.length === 1 ? '' : 's'} not claimed</div>
                <p className="mt-1 text-sm text-slate-600">Sent over 3 days ago with no sign-in — chase or resend.</p>
              </Link>
            ) : null}
            {actions.contractsEnding.length > 0 ? (
              <Link to="/recruiter/applications" className="rounded-2xl border border-purple-200 bg-purple-50 p-4 transition hover:border-purple-300">
                <div className="font-semibold text-purple-900">{actions.contractsEnding.length} contract{actions.contractsEnding.length === 1 ? '' : 's'} ending within 45 days</div>
                <p className="mt-1 text-sm text-purple-800">Hired crew coming available — plan their next placement now.</p>
              </Link>
            ) : null}
            {actions.eventsToday.length > 0 ? (
              <Link to="/recruiter/calendar" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 transition hover:border-blue-300">
                <div className="flex items-center gap-2 font-semibold text-blue-900">
                  <CalendarDays className="h-4 w-4" />
                  {actions.eventsToday.length} event{actions.eventsToday.length === 1 ? '' : 's'} today
                </div>
                <p className="mt-1 text-sm text-blue-800">
                  {actions.eventsToday.slice(0, 2).map((event) => event.event_title || event.event_type).join(' · ')}
                </p>
              </Link>
            ) : null}
          </div>
        </section>

        {/* Requirement delivery */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open requirements" value={metrics.openRequirementsCount} icon={ClipboardList} tone="accent" hint="Approved positions still open." />
          <StatCard label="Closed requirements" value={metrics.closedRequirementsCount} icon={CheckCircle2} tone="success" hint="Requirements where all positions have joined." />
          <StatCard label="Open positions" value={metrics.openPositions} icon={Ship} tone="warning" hint="Balance positions still to be closed." />
          <StatCard label="Joined vs required" value={`${metrics.joinedAgainstRequirements} / ${metrics.positionsRequired}`} icon={ArrowRight} tone="accent" hint="Delivery against approved demand." />
        </div>

        {/* Daily activity + funnel health */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="stat-card">
            <div className="stat-card__header">
              <div>
                <p className="stat-card__label">Requirement closure</p>
                <p className="stat-card__value">{formatPercent(metrics.closureRate)}</p>
              </div>
              <div className="stat-card__icon"><CheckCircle2 className="w-5 h-5" /></div>
            </div>
            <p className="stat-card__hint">
              Closed requirements / total requirements. <TargetPill ok={closureOk}>Target ≥ 95%</TargetPill>
            </p>
          </div>
          <div className="stat-card">
            <div className="stat-card__header">
              <div>
                <p className="stat-card__label">Contact-to-join conversion</p>
                <p className="stat-card__value">{formatPercent(metrics.conversionRate)}</p>
              </div>
              <div className="stat-card__icon"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <p className="stat-card__hint">
              Joined / total candidates touched. <TargetPill ok={conversionOk}>Target 8–12%</TargetPill>
            </p>
          </div>
          <div className="stat-card">
            <div className="stat-card__header">
              <div>
                <p className="stat-card__label">Avg days to join</p>
                <p className="stat-card__value">{metrics.avgDaysToJoin == null ? '—' : formatDays(metrics.avgDaysToJoin)}</p>
              </div>
              <div className="stat-card__icon"><Hourglass className="w-5 h-5" /></div>
            </div>
            <p className="stat-card__hint">Cycle speed from first contact to joining.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Candidates contacted today" value={metrics.contactedTodayCount} icon={PhoneCall} tone="accent" hint="Daily input metric. Target: 15–25 per recruiter." />
          <StatCard label="Candidates joined today" value={metrics.joinedTodayCount} icon={UserPlus} tone="success" hint="Daily result metric — success = joined only." />
          <StatCard label="Active pipeline" value={metrics.activePipelineCount} icon={Users} tone="accent" hint="Candidates still moving through the funnel." />
          <StatCard label="Avg client response" value={clientResponseDays == null ? '—' : formatDays(clientResponseDays)} icon={Hourglass} tone="warning" hint="Submitted to customer → customer decision. Slow clients are visible here, not blamed on recruiters." />
        </div>

        {/* Pipeline by stage + requirement ageing */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Pipeline by stage</h2>
                  <p className="mt-1 text-sm text-slate-600">Where every live candidate currently sits.</p>
                </div>
              </div>
              <Link to="/recruiter/candidates" className="text-sm font-medium text-blue-700 hover:underline">
                View candidates
              </Link>
            </div>
            <div className="space-y-3">
              {FUNNEL_STAGES.map((stage) => {
                const count = metrics.stageCounts[stage] || 0
                return (
                  <div key={stage} className="tracker-stage-bar">
                    <span className={`tracker-pill w-28 justify-center ${STAGE_BADGE_CLASSES[stage]}`}>{stage}</span>
                    <div className="tracker-stage-bar__track">
                      <div
                        className="tracker-stage-bar__fill"
                        style={{ width: `${Math.round((count / maxStageCount) * 100)}%`, opacity: count === 0 ? 0 : 1 }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums text-slate-900">{count}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Hourglass className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Open requirement ageing</h2>
                  <p className="mt-1 text-sm text-slate-600">Oldest open requirements first — these need attention.</p>
                </div>
              </div>
              <Link to="/recruiter/requirements" className="text-sm font-medium text-blue-700 hover:underline">
                View requirements
              </Link>
            </div>
            {metrics.requirementAgeing.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No open requirements"
                description="Every requirement in scope is closed or cancelled."
              />
            ) : (
              <div className="tracker-table-wrap">
                <table className="tracker-table" style={{ minWidth: '520px' }}>
                  <thead>
                    <tr>
                      <th>Req ID</th>
                      <th>Vessel</th>
                      <th>Rank</th>
                      <th className="tracker-cell--num">Open</th>
                      <th className="tracker-cell--num">Days open</th>
                      <th>On-time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.requirementAgeing.slice(0, 8).map((row) => (
                      <tr key={row.id}>
                        <td className="tracker-cell--primary tracker-cell--nowrap">
                          <Link to={`/recruiter/workspace/requirements/${row.id}`} state={{ from: `${location.pathname}${location.search}` }} className="text-blue-700 hover:underline">
                            {row.reqId}
                          </Link>
                        </td>
                        <td>{row.vessel_name || '—'}</td>
                        <td className="tracker-cell--nowrap">{row.rankName}</td>
                        <td className="tracker-cell--num">{row.openPositions}</td>
                        <td className="tracker-cell--num font-semibold">{row.daysOpen ?? '—'}</td>
                        <td>
                          <span className={`tracker-pill ${ON_TIME_BADGE_CLASSES[row.onTimeStatus] || ON_TIME_BADGE_CLASSES['—']}`}>
                            {row.onTimeStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Recruiter scorecard */}
        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recruiter scorecard</h2>
              <p className="mt-1 text-sm text-slate-600">Daily input, joins, conversion, and live pipeline per recruiter.</p>
            </div>
          </div>
          {metrics.scorecard.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No recruiters found"
              description="Recruiter accounts will appear here once they exist."
            />
          ) : (
            <div className="tracker-table-wrap">
              <table className="tracker-table" style={{ minWidth: '640px' }}>
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th className="tracker-cell--num">Contacted today</th>
                    <th className="tracker-cell--num">Total touched</th>
                    <th className="tracker-cell--num">Joined</th>
                    <th className="tracker-cell--num">Conversion</th>
                    <th className="tracker-cell--num">Active pipeline</th>
                    <th className="tracker-cell--num">Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.scorecard.map((row) => (
                    <tr key={row.id}>
                      <td className="tracker-cell--primary">
                        <div>{row.name}</div>
                        {row.roleName ? <div className="mt-0.5 text-xs font-normal text-slate-500">{row.roleName}</div> : null}
                      </td>
                      <td className={`tracker-cell--num ${row.contactedToday >= 15 ? 'text-emerald-700 font-semibold' : ''}`}>{row.contactedToday}</td>
                      <td className="tracker-cell--num">{row.totalTouched}</td>
                      <td className="tracker-cell--num font-semibold">{row.joined}</td>
                      <td className="tracker-cell--num">{formatPercent(row.conversionRate)}</td>
                      <td className="tracker-cell--num">{row.activePipeline}</td>
                      <td className="tracker-cell--num">{row.handlingApplications}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Core rule: success = joined candidates only. Contacted-today target is 15–25 per recruiter; conversion target 8–12%.
            Handling = live applications assigned via the Handled-by selector{metrics.unassignedHandledApplications > 0 ? ` (${metrics.unassignedHandledApplications} active unassigned)` : ''}.
          </p>
        </section>
        </>
        ) : null}

        {kpiTab === 'charts' ? (
        <>
        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Activity vs results, weekly</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Contacts are the input, joins are the outcome — the gap between the two is your conversion story.</p>
          <ChartLegend entries={[{ label: 'Candidates contacted', color: '#2a78d6' }, { label: 'Joins', color: '#1d9e75' }]} />
          <TrendChart
            labels={charts.weekLabels}
            series={[
              { label: 'Contacted', color: '#2a78d6', points: charts.contacts, fill: true },
              { label: 'Joined', color: '#1d9e75', points: charts.joins, dashed: true },
            ]}
          />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Funnel by stage</h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">Where every live candidate currently sits.</p>
            <HBarChart items={charts.funnelItems} />
          </section>
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Open requirements by age</h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">Share of target days already used.</p>
            <ColumnChart
              items={[
                { label: 'On track', value: charts.buckets.onTrack, color: '#0ca30c' },
                { label: 'Past 50%', value: charts.buckets.past50, color: '#fab219' },
                { label: 'Near target', value: charts.buckets.near, color: '#ec835a' },
                { label: 'Overdue', value: charts.buckets.overdue, color: '#d03b3b' },
              ]}
            />
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Open positions by rank</h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">Demand map — where sourcing effort is needed.</p>
            {charts.demandItems.length === 0 ? (
              <EmptyState icon={Ship} title="No open positions" description="Open requirements will populate the demand map." />
            ) : (
              <HBarChart items={charts.demandItems} />
            )}
          </section>
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Time sitting in current stage</h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">Average days since the last move, per pipeline status — the bottleneck finder. Becomes exact time-in-stage as status history accrues.</p>
            {charts.dwellItems.length === 0 ? (
              <EmptyState icon={Hourglass} title="No live applications" description="Submitted applications will populate this chart." />
            ) : (
              <HBarChart items={charts.dwellItems} unit="d" />
            )}
          </section>
        </div>
        </>
        ) : null}

        {kpiTab === 'reports' ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            {
              title: 'Weekly management report (PDF)',
              description: 'Every KPI with targets, open requirement ageing, and the recruiter scorecard — ready for the Monday meeting.',
              action: generateWeeklyPdf,
            },
            {
              title: 'Requirement closure report (CSV)',
              description: 'Per requirement: customer, dates, days to close, target, and on-time status. Your fill-rate proof per client.',
              action: generateClosureCsv,
            },
            {
              title: 'Recruiter productivity report (CSV)',
              description: 'Contacts, joins, conversion, live pipeline, and handling load per recruiter.',
              action: generateProductivityCsv,
            },
            {
              title: 'Funnel drop-off report (CSV)',
              description: 'Candidate counts and share per funnel stage — spot where the pipeline leaks.',
              action: generateFunnelCsv,
            },
          ].map((report) => (
            <section key={report.title} className="recruiter-panel flex flex-col p-5 sm:p-6">
              <h2 className="text-base font-semibold text-slate-900">{report.title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-600">{report.description}</p>
              {canExportData() ? (
                <button
                  type="button"
                  onClick={report.action}
                  disabled={exporting}
                  className="mt-4 inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Generating…' : 'Generate'}
                </button>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Export permission required.</p>
              )}
            </section>
          ))}
          <p className="text-xs text-slate-500 md:col-span-2">
            All reports respect the recruiter filter above and are logged in the export audit trail. Generated {formatDate(new Date().toISOString())}.
          </p>
        </div>
        ) : null}
        </>
        )}
      </main>
    </div>
  )
}
