import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import SegmentedControl from '../components/ui/SegmentedControl'
import useKpiTrackerData from '../hooks/useKpiTrackerData'
import {
  buildCandidateFunnelRows,
  formatDays,
  formatPercent,
  FUNNEL_STAGES,
  localDayString,
  STAGE_BADGE_CLASSES,
} from '../utils/kpiTracker'
import { formatDate } from './recruiterDashboardUtils'
import { downloadCsvReport, logRecruiterExport } from '../services/recruiterReportExportService'
import {
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  RefreshCcw,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'

const VIEW_FILTERS = [
  { value: 'active', label: 'Active pipeline' },
  { value: 'joined', label: 'Joined' },
  { value: 'closed', label: 'Rejected / Withdrawn' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

export default function RecruiterCandidatesPage() {
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const { role, loading: permLoading, canExportData } = usePermissions()
  const tracker = useKpiTrackerData({ enabled: !permLoading })

  const [viewFilter, setViewFilter] = useState('active')
  const [stageFilter, setStageFilter] = useState('')
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const rows = useMemo(() => buildCandidateFunnelRows({
    ...tracker.data,
    notes: tracker.data.prospectNotes,
  }), [tracker.data])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (viewFilter === 'active' && !row.inActivePipeline) return false
      if (viewFilter === 'joined' && !(row.hasJoined && !row.isArchived)) return false
      if (viewFilter === 'closed' && !(['Rejected', 'Withdrawn'].includes(row.stage) && !row.isArchived)) return false
      if (viewFilter === 'archived' && !row.isArchived) return false
      if (stageFilter && row.stage !== stageFilter) return false
      if (recruiterFilter && row.created_by_recruiter_id !== recruiterFilter) return false
      const contactedDay = localDayString(row.contactedAt)
      if (dateFrom && (!contactedDay || contactedDay < dateFrom)) return false
      if (dateTo && (!contactedDay || contactedDay > dateTo)) return false
      if (query) {
        const haystack = [row.name, row.email, row.rankName, row.vesselTypeName, row.requirementLabel, row.recruiterName]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [rows, viewFilter, stageFilter, recruiterFilter, search, dateFrom, dateTo])

  const viewCounts = useMemo(() => ({
    active: rows.filter((row) => row.inActivePipeline).length,
    joined: rows.filter((row) => row.hasJoined && !row.isArchived).length,
    closed: rows.filter((row) => ['Rejected', 'Withdrawn'].includes(row.stage) && !row.isArchived).length,
    archived: rows.filter((row) => row.isArchived).length,
    all: rows.length,
  }), [rows])

  const liveRows = rows.filter((row) => !row.isArchived)
  const joinedRows = liveRows.filter((row) => row.hasJoined)
  const conversion = liveRows.length === 0 ? 0 : joinedRows.length / liveRows.length
  const joinDurations = joinedRows.map((row) => row.daysToJoin).filter((value) => Number.isFinite(value) && value >= 0)
  const avgDaysToJoin = joinDurations.length === 0
    ? null
    : joinDurations.reduce((sum, value) => sum + value, 0) / joinDurations.length

  const exportCsv = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await runExport()
    } catch (error) {
      console.error('Candidate funnel export failed:', error)
      setExportError(error?.message || 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const runExport = async () => {
    await logRecruiterExport({
      reportType: 'candidate_funnel',
      exportFormat: 'csv',
      rowIds: filteredRows.map((row) => row.id),
      rowCount: filteredRows.length,
      filters: { viewFilter, stageFilter, recruiterFilter, search, dateFrom, dateTo },
      notesIncluded: true,
    })
    await downloadCsvReport({
      filename: `candidate-funnel-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Candidate Name', value: (row) => row.name },
        { label: 'Date Contacted', value: (row) => localDayString(row.contactedAt) },
        { label: 'Recruiter', value: (row) => row.recruiterName },
        { label: 'Req ID', value: (row) => (row.primaryRequirement?.req_id_display || '') },
        { label: 'Rank', value: (row) => row.rankName },
        { label: 'Vessel Type', value: (row) => row.vesselTypeName },
        { label: 'Current Stage', value: (row) => row.stage },
        { label: 'Date Joined', value: (row) => localDayString(row.joinedAt) },
        { label: 'Joined?', value: (row) => (row.hasJoined ? 'Yes' : 'No') },
        { label: 'Days to Join', value: (row) => (row.daysToJoin ?? '') },
        { label: 'In Active Pipeline?', value: (row) => (row.inActivePipeline ? 'Yes' : 'No') },
        { label: 'Cycle Completed?', value: (row) => (row.cycleCompleted ? 'Yes' : 'No') },
        { label: 'Notes', value: (row) => row.latestNote },
      ],
      rows: filteredRows,
    })
  }

  if (permLoading || tracker.loading) {
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

  return (
    <div className="min-h-screen bg-raised">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Candidates"
          actions={(
            <div className="flex flex-wrap gap-3">
              {canExportData() ? (
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting…' : 'Export CSV'}
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
              <Link
                to="/recruiter/workspace?tab=candidates"
                className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-medium text-fg-secondary transition hover:bg-raised"
              >
                <Plus className="h-4 w-4" />
                Add candidate
              </Link>
            </div>
          )}
        />

        {exportError ? (
          <div className="mt-6 rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
            {exportError}
          </div>
        ) : null}

        {tracker.error ? (
          <div className="mt-6 rounded-control border border-danger-line bg-danger-soft px-5 py-6 text-sm text-danger">
            <p className="font-semibold">Could not load the candidate funnel.</p>
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
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active pipeline" value={viewCounts.active} icon={Users} tone="accent" />
          <StatCard label="Joined" value={viewCounts.joined} icon={CheckCircle2} tone="success" />
          <StatCard label="Contact-to-join conversion" value={formatPercent(conversion)} icon={TrendingUp} tone="accent" />
          <StatCard label="Avg days to join" value={avgDaysToJoin == null ? '—' : formatDays(avgDaysToJoin)} icon={UserPlus} tone="warning" />
        </div>

        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl
                options={VIEW_FILTERS.map((option) => ({ ...option, count: viewCounts[option.value] }))}
                value={viewFilter}
                onChange={setViewFilter}
                size="sm"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-fg-muted">Search</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, email, rank, requirement…"
                  className="w-56 rounded-control border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-fg-muted">Stage</span>
                <select
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                  className="w-40 rounded-control border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">All stages</option>
                  {FUNNEL_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-fg-muted">Recruiter</span>
                <select
                  value={recruiterFilter}
                  onChange={(event) => setRecruiterFilter(event.target.value)}
                  className="w-44 rounded-control border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">All recruiters</option>
                  {tracker.data.recruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.full_name || recruiter.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-fg-muted">Contacted from</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-control border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-fg-muted">Contacted to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-control border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </label>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No candidates match"
            />
          ) : (
            <div className="tracker-table-wrap max-h-[38rem] overflow-y-auto">
              <table className="tracker-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Contacted</th>
                    <th>Recruiter</th>
                    <th>Requirement</th>
                    <th>Rank</th>
                    <th>Vessel type</th>
                    <th>Stage</th>
                    <th>Joined on</th>
                    <th className="tracker-cell--num">Days to join</th>
                    <th>Pipeline</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="tracker-cell--primary">
                        <div>{row.name}</div>
                        <div className="mt-0.5 text-xs font-normal text-fg-muted">{row.email}</div>
                      </td>
                      <td className="tracker-cell--nowrap">{formatDate(row.contactedAt)}</td>
                      <td className="tracker-cell--nowrap">{row.recruiterName}</td>
                      <td className="tracker-cell--nowrap">
                        {row.primaryRequirement ? (
                          <Link
                            to={`/recruiter/workspace/requirements/${row.primaryRequirement.id}`} state={{ from: `${location.pathname}${location.search}` }}
                            className="text-accent-text hover:underline"
                          >
                            {row.requirementLabel}
                          </Link>
                        ) : (
                          <span className="tracker-cell--muted">Unassigned</span>
                        )}
                      </td>
                      <td className="tracker-cell--nowrap">{row.rankName}</td>
                      <td className="tracker-cell--nowrap">{row.vesselTypeName}</td>
                      <td>
                        <span className={`tracker-pill ${STAGE_BADGE_CLASSES[row.stage] || 'bg-raised text-fg-secondary'}`}>
                          {row.stage}
                        </span>
                        {row.isArchived ? (
                          <span className="tracker-pill ml-1.5 bg-line text-fg-secondary">Archived</span>
                        ) : null}
                      </td>
                      <td className="tracker-cell--nowrap">{row.joinedAt ? formatDate(row.joinedAt) : '—'}</td>
                      <td className="tracker-cell--num">{row.daysToJoin ?? '—'}</td>
                      <td className="tracker-cell--nowrap">
                        {row.inActivePipeline ? (
                          <span className="tracker-pill bg-accent-soft text-accent-text">
                            {row.daysSinceContact == null ? 'Active · not contacted' : `Active · ${row.daysSinceContact}d`}
                          </span>
                        ) : row.cycleCompleted ? (
                          <span className="tracker-pill bg-success-soft text-success">Completed</span>
                        ) : (
                          <span className="tracker-pill bg-raised text-fg-secondary">Closed</span>
                        )}
                      </td>
                      <td className="max-w-[16rem] tracker-cell--muted">
                        <span className="line-clamp-2">{row.latestNote || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-fg-muted">
            {filteredRows.length} candidate{filteredRows.length === 1 ? '' : 's'} shown of {rows.length} tracked.
          </p>
        </section>
        </>
        )}
      </main>
    </div>
  )
}
