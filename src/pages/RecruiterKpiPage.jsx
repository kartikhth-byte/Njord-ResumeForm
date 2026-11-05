import { useMemo, useState } from 'react'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
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
  localDayString,
  FUNNEL_STAGES,
  KPI_PERIODS,
  ON_TIME_BADGE_CLASSES,
  workingRecruiters,
} from '../utils/kpiTracker'
import { formatDateTime } from './recruiterDashboardUtils'
import { downloadCsvReport, downloadPdfReport, logRecruiterExport } from '../services/recruiterReportExportService'
import SegmentedControl from '../components/ui/SegmentedControl'
import { HBarChart, TrendChart, ColumnChart, ChartLegend } from '../components/charts/SimpleCharts'
import { chartColor, toneColor } from '../constants/chartColors'
import { buildRecruitmentCaseKpi, CASE_STAGES } from '../utils/recruitmentCaseKpi'
import { caseStatusMeta } from '../utils/recruitmentCase'
import {
  ArrowRight,
  BarChart3,
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

function formatRate(value) {
  return value == null ? '—' : formatPercent(value)
}

export default function RecruiterKpiPage() {
  const { user, profile, signOut } = useAuth()
  const { role, loading: permLoading, canExportData, canViewAnalytics } = usePermissions()
  const hasKpiAccess = canViewAnalytics()
  const tracker = useKpiTrackerData({ enabled: !permLoading && hasKpiAccess })
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [period, setPeriod] = useState('month')
  const [kpiTab, setKpiTab] = useState('overview')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const requirementRows = useMemo(() => buildRequirementTrackerRows({
    ...tracker.data,
    remarks: tracker.data.requirementRemarks,
  }), [tracker.data])
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
      : workingRecruiters(tracker.data.recruiters),
    period,
  }), [scopedRequirements, scopedCandidates, tracker.data.applications, tracker.data.recruiters, recruiterFilter, period])

  const periodLabel = KPI_PERIODS.find((option) => option.value === period)?.label || 'All time'
  const periodFrom = metrics.periodStart ? localDayString(metrics.periodStart) : ''
  const caseKpi = useMemo(() => buildRecruitmentCaseKpi({
    cases: tracker.data.cases,
    events: tracker.data.caseEvents,
    requirementIds: scopedRequirements.map((row) => row.id),
    periodStart: metrics.periodStart,
  }), [tracker.data.cases, tracker.data.caseEvents, scopedRequirements, metrics.periodStart])
  const recruiterParam = recruiterFilter ? `&recruiter=${encodeURIComponent(recruiterFilter)}` : ''
  const requirementsLink = (status) => `/recruiter/requirements?status=${status}${recruiterParam}`
  const candidatesLink = (view, from = '') => `/recruiter/candidates?view=${view}${from ? `&from=${from}` : ''}${recruiterParam}`

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

    const funnelColors = [chartColor(2), chartColor(1), chartColor(5), chartColor(4), chartColor(6), toneColor('success'), toneColor('danger'), toneColor('neutral')]
    const funnelItems = (tracker.data.casesAvailable ? CASE_STAGES : FUNNEL_STAGES).map((stage, index) => ({
      label: tracker.data.casesAvailable ? caseStatusMeta(stage).label : stage,
      value: tracker.data.casesAvailable ? caseKpi.statusCounts[stage] || 0 : metrics.stageCounts[stage] || 0,
      color: funnelColors[index % funnelColors.length],
    })).filter((item) => item.value > 0)

    return { weekLabels: weeks.map((week) => week.label), contacts, joins, buckets, demandItems, funnelItems }
  }, [scopedCandidates, scopedRequirements, tracker.data.casesAvailable, metrics.stageCounts, caseKpi.statusCounts])

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
        { label: `Conversion, ${periodLabel.toLowerCase()} (target 8–12%)`, value: formatRate(metrics.periodConversionRate) },
        { label: 'Active pipeline', value: metrics.activePipelineCount },
        { label: 'Avg days to join', value: metrics.avgDaysToJoin == null ? '—' : formatDays(metrics.avgDaysToJoin) },
        ...(tracker.data.casesAvailable ? [
          { label: 'Active recruitment cases', value: caseKpi.active },
          { label: 'Closed recruitment cases', value: caseKpi.closed },
          { label: 'Test pass rate (recorded outcomes)', value: formatRate(caseKpi.testPassRate) },
          { label: 'Interview pass rate (recorded outcomes)', value: formatRate(caseKpi.interviewPassRate) },
        ] : []),
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
          headers: ['Recruiter', 'Contacted today', 'Touched', 'Joined', `Conversion, ${periodLabel.toLowerCase()}`, 'Pipeline', 'Handling'],
          rows: metrics.scorecard.map((row) => [
            row.name, String(row.contactedToday), String(row.totalTouched), String(row.joined),
            formatRate(row.periodConversionRate), String(row.activePipeline), String(row.handlingApplications),
          ]),
        },
      ],
      footerNote: 'Case assessment figures come from case events. Requirement and contact figures use legacy tracker data.',
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
        { label: `Conversion % (${periodLabel.toLowerCase()})`, value: (row) => (row.periodConversionRate == null ? '' : Math.round(row.periodConversionRate * 100)) },
        { label: 'Active pipeline', value: (row) => row.activePipeline },
        { label: 'Handling applications', value: (row) => row.handlingApplications },
      ],
      rows: metrics.scorecard,
    })
  })

  const generateFunnelCsv = () => runReport(async () => {
    const caseSource = tracker.data.casesAvailable
    const stageCounts = caseSource ? caseKpi.statusCounts : metrics.stageCounts
    const stages = caseSource ? CASE_STAGES : FUNNEL_STAGES
    const total = stages.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0)
    const rows = stages.map((stage) => ({
      stage: caseSource ? caseStatusMeta(stage).label : stage,
      count: stageCounts[stage] || 0,
      share: total === 0 ? 0 : Math.round(((stageCounts[stage] || 0) / total) * 100),
    }))
    await logRecruiterExport({
      reportType: 'funnel_dropoff_report',
      exportFormat: 'csv',
      rowIds: caseSource ? tracker.data.cases.filter((row) => scopedRequirements.some((requirement) => requirement.id === row.requirement_id)).map((row) => row.id) : scopedCandidates.map((row) => row.id),
      rowCount: rows.length,
      filters: { recruiterFilter },
    })
    await downloadCsvReport({
      filename: `${caseSource ? 'case-stage-distribution' : 'funnel-dropoff'}-${new Date().toISOString().slice(0, 10)}`,
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
      ...(tracker.data.casesAvailable ? [
        { metric: 'Active recruitment cases', value: caseKpi.active, target: '', comment: 'Current case status' },
        { metric: 'Closed recruitment cases', value: caseKpi.closed, target: '', comment: 'Current case status' },
        { metric: 'Test pass rate', value: formatRate(caseKpi.testPassRate), target: '', comment: 'Case event outcomes in period; repeated attempts count' },
        { metric: 'Interview pass rate', value: formatRate(caseKpi.interviewPassRate), target: '', comment: 'Case event outcomes in period; repeated attempts count' },
        ...CASE_STAGES.map((stage) => ({ metric: `Case stage: ${caseStatusMeta(stage).label}`, value: caseKpi.statusCounts[stage] || 0, target: '', comment: 'One count per case cycle' })),
      ] : []),
      { metric: 'Open Requirements (#)', value: metrics.openRequirementsCount, target: '', comment: 'Approved positions still open' },
      { metric: 'Closed Requirements (#)', value: metrics.closedRequirementsCount, target: '', comment: 'All positions joined' },
      { metric: 'Open Positions', value: metrics.openPositions, target: '', comment: 'Balance positions to be closed' },
      { metric: 'Joined vs Required', value: `${metrics.joinedAgainstRequirements} / ${metrics.positionsRequired}`, target: '', comment: 'Delivery against approved demand' },
      { metric: 'Requirement Closure %', value: formatPercent(metrics.closureRate), target: '>=95%', comment: 'Closed requirements / total requirements' },
      { metric: 'Candidates Contacted Today', value: metrics.contactedTodayCount, target: '15-25 / recruiter', comment: 'Daily input metric' },
      { metric: 'Candidates Joined Today', value: metrics.joinedTodayCount, target: '', comment: 'Daily result metric' },
      { metric: `Conversion % (${periodLabel.toLowerCase()})`, value: formatRate(metrics.periodConversionRate), target: '8-12%', comment: 'Of candidates first contacted in the period, the share that joined' },
      { metric: 'Active Pipeline', value: metrics.activePipelineCount, target: '', comment: 'Candidates still active' },
      { metric: 'Avg Days to Join', value: metrics.avgDaysToJoin == null ? '' : Math.round(metrics.avgDaysToJoin * 10) / 10, target: '', comment: 'Speed from contact to join' },
      ...FUNNEL_STAGES.map((stage) => ({ metric: `Legacy pipeline: ${stage}`, value: metrics.stageCounts[stage] || 0, target: '', comment: 'Prospect/application tracker stage' })),
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
  const conversionOk = metrics.periodConversionRate != null && metrics.periodConversionRate >= 0.08

  return (
    <div className="min-h-screen bg-raised">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="KPI"
          actions={(
            <div className="flex flex-wrap gap-3">
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
                {workingRecruiters(tracker.data.recruiters).map((recruiter) => (
                  <option key={recruiter.id} value={recruiter.id}>
                    {recruiter.full_name || recruiter.email}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-xs font-medium text-fg-muted">Period</span>
              <SegmentedControl options={KPI_PERIODS} value={period} onChange={setPeriod} size="sm" />
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
          <SegmentedControl options={canExportData() ? KPI_TABS : KPI_TABS.filter((tab) => tab.value !== 'reports')} value={kpiTab} onChange={setKpiTab} />
        </div>

        {kpiTab === 'overview' ? (
        <>
        {tracker.data.casesAvailable ? (
          <section className="recruiter-panel mt-6 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-fg">Recruitment cases</h2>
            <p className="mt-1 text-sm text-fg-secondary">Current case stages; assessment outcomes recorded {periodLabel.toLowerCase()}. Repeated attempts are counted separately.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Active cases" value={caseKpi.active} icon={Users} tone="accent" />
              <StatCard label="Closed cases" value={caseKpi.closed} icon={CheckCircle2} tone="success" />
              <StatCard label="Test pass rate" value={formatRate(caseKpi.testPassRate)} icon={ClipboardList} tone="accent" />
              <StatCard label="Interview pass rate" value={formatRate(caseKpi.interviewPassRate)} icon={TrendingUp} tone="success" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-fg-secondary">
              <span>Tests: {caseKpi.outcomes.test_scheduled} scheduled · {caseKpi.outcomes.test_passed} passed · {caseKpi.outcomes.test_failed} failed · {caseKpi.outcomes.test_no_show} no-show · {caseKpi.outcomes.test_waived} waived</span>
              <span>Interviews: {caseKpi.outcomes.interview_scheduled} scheduled · {caseKpi.outcomes.interview_passed} passed · {caseKpi.outcomes.interview_failed} failed · {caseKpi.outcomes.interview_no_show} no-show</span>
            </div>
          </section>
        ) : null}
        {/* Requirement delivery */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label={`Closed, ${periodLabel.toLowerCase()}`} value={metrics.closedInPeriodCount} icon={CheckCircle2} tone="success" to={requirementsLink('closed')} />
          <StatCard label="Open positions" value={metrics.openPositions} icon={Ship} tone="warning" to={requirementsLink('open')} />
          <StatCard label="Joined vs required" value={`${metrics.joinedAgainstRequirements} / ${metrics.positionsRequired}`} icon={ArrowRight} tone="accent" to={candidatesLink('joined')} />
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
                <p className="stat-card__label">{`Conversion, ${periodLabel.toLowerCase()}`}</p>
                <p className="stat-card__value">{formatRate(metrics.periodConversionRate)}</p>
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
                <p className="stat-card__label">{`Avg days to join, ${periodLabel.toLowerCase()}`}</p>
                <p className="stat-card__value">{metrics.periodAvgDaysToJoin == null ? '—' : formatDays(metrics.periodAvgDaysToJoin)}</p>
              </div>
              <div className="stat-card__icon"><Hourglass className="w-5 h-5" /></div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Contacted today" value={metrics.contactedTodayCount} icon={PhoneCall} tone="accent" to={candidatesLink('all', localDayString(new Date()))} />
          <StatCard label={`Contacted, ${periodLabel.toLowerCase()}`} value={metrics.contactedInPeriodCount} icon={PhoneCall} tone="accent" to={candidatesLink('all', periodFrom)} />
          <StatCard label={`Joined, ${periodLabel.toLowerCase()}`} value={metrics.joinedInPeriodCount} icon={UserPlus} tone="success" to={candidatesLink('joined')} />
          <StatCard label="Avg client response" value={clientResponseDays == null ? '—' : formatDays(clientResponseDays)} icon={Hourglass} tone="warning" />
        </div>

        {/* Recruiter scorecard */}
        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-card bg-raised text-fg-secondary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-fg">Recruiter scorecard</h2>
              <p className="mt-1 text-sm text-fg-secondary">{periodLabel}</p>
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
              <table className="tracker-table" style={{ minWidth: '880px' }}>
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th className="tracker-cell--num">Open reqs</th>
                    <th className="tracker-cell--num">Overdue</th>
                    <th className="tracker-cell--num">Contacted</th>
                    <th className="tracker-cell--num">Joined</th>
                    <th className="tracker-cell--num">Conversion</th>
                    <th className="tracker-cell--num">On-time closure</th>
                    <th className="tracker-cell--num">Avg days to join</th>
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
                      <td className="tracker-cell--num">{row.openRequirements}</td>
                      <td className={`tracker-cell--num ${row.overdueRequirements > 0 ? 'font-semibold text-danger' : ''}`}>{row.overdueRequirements}</td>
                      <td className="tracker-cell--num">{row.contactedInPeriod}</td>
                      <td className="tracker-cell--num font-semibold">{row.joinedInPeriod}</td>
                      <td className="tracker-cell--num">{formatRate(row.periodConversionRate)}</td>
                      <td className="tracker-cell--num">{formatRate(row.onTimeClosureRate)}</td>
                      <td className="tracker-cell--num">{row.avgDaysToJoin == null ? '—' : formatDays(row.avgDaysToJoin)}</td>
                      <td className="tracker-cell--num">{row.activePipeline}</td>
                      <td className="tracker-cell--num">{row.handlingApplications}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-fg-muted">Targets: 15–25 contacts per recruiter per day, 8–12% conversion.</p>
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
            <h2 className="text-lg font-semibold text-fg">{tracker.data.casesAvailable ? 'Cases by current stage' : 'Funnel by stage'}</h2>
            <p className="mb-4 mt-1 text-sm text-fg-secondary">{tracker.data.casesAvailable ? 'One count per case cycle, including closed cases.' : 'Legacy candidate stages, until recruitment cases are available.'}</p>
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
            <div className="mb-4" />
            {charts.demandItems.length === 0 ? (
              <EmptyState icon={Ship} title="No open positions" />
            ) : (
              <HBarChart items={charts.demandItems} />
            )}
          </section>
        </div>
        </>
        ) : null}

        {kpiTab === 'reports' && canExportData() ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            {
              title: 'Management report (PDF)',
              description: 'KPIs, requirement ageing, recruiter scorecard.',
              action: generateWeeklyPdf,
            },
            {
              title: 'KPI summary (CSV)',
              description: 'Every headline figure on this page.',
              action: exportSummary,
            },
            {
              title: 'Recruiter productivity report (CSV)',
              description: 'Contacts, joins and conversion per recruiter.',
              action: generateProductivityCsv,
            },
            {
              title: tracker.data.casesAvailable ? 'Case stage distribution (CSV)' : 'Funnel drop-off report (CSV)',
              description: tracker.data.casesAvailable ? 'Recruitment cases per current stage.' : 'Candidates per legacy funnel stage.',
              action: generateFunnelCsv,
            },
          ].map((report) => (
            <section key={report.title} className="recruiter-panel flex flex-col p-5 sm:p-6">
              <h2 className="text-base font-semibold text-fg">{report.title}</h2>
              <p className="mt-1 flex-1 text-sm text-fg-secondary">{report.description}</p>
              <button
                type="button"
                onClick={report.action}
                disabled={exporting}
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Generating…' : 'Download'}
              </button>
            </section>
          ))}
        </div>
        ) : null}
        </>
        )}
      </main>
    </div>
  )
}
