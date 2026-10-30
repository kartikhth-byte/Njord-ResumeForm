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
import { chartColor, toneColor } from '../constants/chartColors'
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
    <span className={`tracker-pill ${ok ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
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
      .map(([label, value]) => ({ label, value, color: chartColor(1) }))

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
        color: chartColor(5),
      }))
      .sort((a, b) => b.value - a.value)

    const funnelColors = [chartColor(2), chartColor(1), chartColor(5), chartColor(4), chartColor(6), toneColor('success'), toneColor('danger'), toneColor('neutral')]
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
      <div className="min-h-screen bg-raised">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent-text" />
        </div>
      </div>
    )
  }

  // Mirror the nav gate at page level so the org-wide dashboard (including the
  // per-recruiter scorecard) cannot be opened by direct URL without access.
  if (!hasKpiAccess) {
    return (
      <div className="min-h-screen bg-raised">
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
    <div className="min-h-screen bg-raised">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="KPI"
          actions={(
            <div className="flex flex-wrap gap-3">
              {canExportData() ? (
                <button
                  type="button"
                  onClick={exportSummary}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting…' : 'Export summary'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={tracker.reload}
                className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-medium text-fg-secondary transition hover:bg-raised"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          )}
        >
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-fg-muted">Recruiter</span>
              <select
                value={recruiterFilter}
                onChange={(event) => setRecruiterFilter(event.target.value)}
                className="w-56 rounded-control border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              >
                <option value="">All recruiters</option>
                {tracker.data.recruiters.map((recruiter) => (
                  <option key={recruiter.id} value={recruiter.id}>
                    {recruiter.full_name || recruiter.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-control border border-line bg-surface px-4 py-2.5 text-sm text-fg-secondary">
              <span className="font-medium text-fg">Report date:</span> {formatDateTime(new Date().toISOString())}
            </div>
          </div>
        </PageHeader>

        {exportError ? (
          <div className="mt-6 rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
            {exportError}
          </div>
        ) : null}

        {tracker.error ? (
          <div className="mt-6 rounded-control border border-danger-line bg-danger-soft px-5 py-6 text-sm text-danger">
            <p className="font-semibold">Could not load the live dashboard.</p>
            <p className="mt-1">{tracker.error}</p>
            <button
              type="button"
              onClick={tracker.reload}
              className="mt-4 inline-flex items-center gap-2 rounded-control border border-danger-line bg-surface px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
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
            <div className={`flex h-10 w-10 items-center justify-center rounded-card ${actions.total > 0 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-fg">Needs action now</h2>
              <p className="mt-1 text-sm text-fg-secondary">
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
                className="rounded-card border border-danger-line bg-danger-soft p-4 transition hover:border-danger-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-danger">{row.reqId}</span>
                  <span className="tracker-pill bg-danger-soft text-danger">Overdue</span>
                </div>
                <p className="mt-1 text-sm text-danger">
                  {row.vessel_name || 'Vessel TBC'} · {row.rankName} · {row.daysOpen} days open (target {row.targetDays})
                </p>
              </Link>
            ))}
            {actions.nearTarget.slice(0, 3).map((row) => (
              <Link
                key={row.id}
                to={`/recruiter/workspace/requirements/${row.id}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="rounded-card border border-warning-line bg-warning-soft p-4 transition hover:border-warning-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-warning">{row.reqId}</span>
                  <span className="tracker-pill bg-warning-soft text-warning">Near target</span>
                </div>
                <p className="mt-1 text-sm text-warning">
                  {row.vessel_name || 'Vessel TBC'} · {row.rankName} · {row.daysOpen} of {row.targetDays} target days used
                </p>
              </Link>
            ))}
            {actions.staleReview.length > 0 ? (
              <Link to="/recruiter/applications" className="rounded-card border border-warning-line bg-warning-soft p-4 transition hover:border-warning-line">
                <div className="font-semibold text-warning">{actions.staleReview.length} application{actions.staleReview.length === 1 ? '' : 's'} awaiting review</div>
                <p className="mt-1 text-sm text-warning">Submitted more than 7 days ago and still not in review.</p>
              </Link>
            ) : null}
            {actions.unassigned.length > 0 ? (
              <Link to="/recruiter/applications" className="rounded-card border border-line bg-surface p-4 transition hover:border-line-input">
                <div className="font-semibold text-fg">{actions.unassigned.length} live application{actions.unassigned.length === 1 ? '' : 's'} unassigned</div>
              </Link>
            ) : null}
            {actions.unclaimedInvites.length > 0 ? (
              <Link to="/recruiter/workspace?tab=candidates" className="rounded-card border border-line bg-surface p-4 transition hover:border-line-input">
                <div className="font-semibold text-fg">{actions.unclaimedInvites.length} invite{actions.unclaimedInvites.length === 1 ? '' : 's'} not claimed</div>
              </Link>
            ) : null}
            {actions.contractsEnding.length > 0 ? (
              <Link to="/recruiter/applications" className="rounded-card border border-progress-line bg-progress-soft p-4 transition hover:border-progress-line">
                <div className="font-semibold text-progress">{actions.contractsEnding.length} contract{actions.contractsEnding.length === 1 ? '' : 's'} ending within 45 days</div>
              </Link>
            ) : null}
            {actions.eventsToday.length > 0 ? (
              <Link to="/recruiter/calendar" className="rounded-card border border-accent/40 bg-accent-soft p-4 transition hover:border-accent">
                <div className="flex items-center gap-2 font-semibold text-accent-text">
                  <CalendarDays className="h-4 w-4" />
                  {actions.eventsToday.length} event{actions.eventsToday.length === 1 ? '' : 's'} today
                </div>
                <p className="mt-1 text-sm text-accent-text">
                  {actions.eventsToday.slice(0, 2).map((event) => event.event_title || event.event_type).join(' · ')}
                </p>
              </Link>
            ) : null}
          </div>
        </section>

        {/* Requirement delivery */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open requirements" value={metrics.openRequirementsCount} icon={ClipboardList} tone="accent" />
          <StatCard label="Closed requirements" value={metrics.closedRequirementsCount} icon={CheckCircle2} tone="success" />
          <StatCard label="Open positions" value={metrics.openPositions} icon={Ship} tone="warning" />
          <StatCard label="Joined vs required" value={`${metrics.joinedAgainstRequirements} / ${metrics.positionsRequired}`} icon={ArrowRight} tone="accent" />
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
              <TargetPill ok={closureOk}>Target ≥ 95%</TargetPill>
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
              <TargetPill ok={conversionOk}>Target 8–12%</TargetPill>
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
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Candidates contacted today" value={metrics.contactedTodayCount} icon={PhoneCall} tone="accent" />
          <StatCard label="Candidates joined today" value={metrics.joinedTodayCount} icon={UserPlus} tone="success" />
          <StatCard label="Active pipeline" value={metrics.activePipelineCount} icon={Users} tone="accent" />
          <StatCard label="Avg client response" value={clientResponseDays == null ? '—' : formatDays(clientResponseDays)} icon={Hourglass} tone="warning" />
        </div>

        {/* Pipeline by stage + requirement ageing */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-card bg-raised text-fg-secondary">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-fg">Pipeline by stage</h2>
                  <p className="mt-1 text-sm text-fg-secondary">Where every live candidate currently sits.</p>
                </div>
              </div>
              <Link to="/recruiter/candidates" className="text-sm font-medium text-accent-text hover:underline">
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
                    <span className="w-8 text-right text-sm font-semibold tabular-nums text-fg">{count}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-card bg-raised text-fg-secondary">
                  <Hourglass className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-fg">Open requirement ageing</h2>
                </div>
              </div>
              <Link to="/recruiter/requirements" className="text-sm font-medium text-accent-text hover:underline">
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
                          <Link to={`/recruiter/workspace/requirements/${row.id}`} state={{ from: `${location.pathname}${location.search}` }} className="text-accent-text hover:underline">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-card bg-raised text-fg-secondary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-fg">Recruiter scorecard</h2>
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
                        {row.roleName ? <div className="mt-0.5 text-xs font-normal text-fg-muted">{row.roleName}</div> : null}
                      </td>
                      <td className={`tracker-cell--num ${row.contactedToday >= 15 ? 'text-success font-semibold' : ''}`}>{row.contactedToday}</td>
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
          <p className="mt-4 text-xs text-fg-muted">
            Core rule: success = joined candidates only. Contacted-today target is 15–25 per recruiter; conversion target 8–12%.
            Handling = live applications assigned via the Handled-by selector{metrics.unassignedHandledApplications > 0 ? ` (${metrics.unassignedHandledApplications} active unassigned)` : ''}.
          </p>
        </section>
        </>
        ) : null}

        {kpiTab === 'charts' ? (
        <>
        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-fg">Activity vs results, weekly</h2>
          <ChartLegend entries={[{ label: 'Candidates contacted', color: chartColor(1) }, { label: 'Joins', color: toneColor('success') }]} />
          <TrendChart
            labels={charts.weekLabels}
            series={[
              { label: 'Contacted', color: chartColor(1), points: charts.contacts, fill: true },
              { label: 'Joined', color: toneColor('success'), points: charts.joins, dashed: true },
            ]}
          />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-fg">Funnel by stage</h2>
            <p className="mb-4 mt-1 text-sm text-fg-secondary">Where every live candidate currently sits.</p>
            <HBarChart items={charts.funnelItems} />
          </section>
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-fg">Open requirements by age</h2>
            <p className="mb-4 mt-1 text-sm text-fg-secondary">Share of target days already used.</p>
            <ColumnChart
              items={[
                { label: 'On track', value: charts.buckets.onTrack, color: toneColor('success') },
                { label: 'Past 50%', value: charts.buckets.past50, color: toneColor('warning') },
                { label: 'Near target', value: charts.buckets.near, color: chartColor(1) },
                { label: 'Overdue', value: charts.buckets.overdue, color: toneColor('danger') },
              ]}
            />
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-fg">Open positions by rank</h2>
            <p className="mb-4 mt-1 text-sm text-fg-secondary">Demand map — where sourcing effort is needed.</p>
            {charts.demandItems.length === 0 ? (
              <EmptyState icon={Ship} title="No open positions" description="Open requirements will populate the demand map." />
            ) : (
              <HBarChart items={charts.demandItems} />
            )}
          </section>
          <section className="recruiter-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-fg">Time sitting in current stage</h2>
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
              description: 'KPIs, requirement ageing, recruiter scorecard.',
              action: generateWeeklyPdf,
            },
            {
              title: 'Requirement closure report (CSV)',
              description: 'Days to close and on-time status per requirement.',
              action: generateClosureCsv,
            },
            {
              title: 'Recruiter productivity report (CSV)',
              description: 'Contacts, joins and conversion per recruiter.',
              action: generateProductivityCsv,
            },
            {
              title: 'Funnel drop-off report (CSV)',
              description: 'Candidates per funnel stage.',
              action: generateFunnelCsv,
            },
          ].map((report) => (
            <section key={report.title} className="recruiter-panel flex flex-col p-5 sm:p-6">
              <h2 className="text-base font-semibold text-fg">{report.title}</h2>
              <p className="mt-1 flex-1 text-sm text-fg-secondary">{report.description}</p>
              {canExportData() ? (
                <button
                  type="button"
                  onClick={report.action}
                  disabled={exporting}
                  className="mt-4 inline-flex w-fit items-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Generating…' : 'Generate'}
                </button>
              ) : (
                <p className="mt-4 text-xs text-fg-muted">Export permission required.</p>
              )}
            </section>
          ))}
          <p className="text-xs text-fg-muted md:col-span-2">
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
