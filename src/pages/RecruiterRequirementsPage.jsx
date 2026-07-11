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
  buildRequirementTrackerRows,
  formatDays,
  ON_TIME_BADGE_CLASSES,
} from '../utils/kpiTracker'
import { getStatusMeta, REQUIREMENT_STATUS_META, formatDate } from './recruiterDashboardUtils'
import { downloadCsvReport, logRecruiterExport } from '../services/recruiterReportExportService'
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  Plus,
  RefreshCcw,
  Ship,
  Users,
} from 'lucide-react'

const STATUS_FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

export default function RecruiterRequirementsPage() {
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const { role, loading: permLoading, canExportData } = usePermissions()
  const tracker = useKpiTrackerData({ enabled: !permLoading })

  const [statusFilter, setStatusFilter] = useState('open')
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const rows = useMemo(() => buildRequirementTrackerRows({
    ...tracker.data,
    remarks: tracker.data.requirementRemarks,
  }), [tracker.data])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === 'open' && (row.status !== 'open' || row.isArchived)) return false
      if (statusFilter === 'closed' && (row.status !== 'closed' || row.isArchived)) return false
      if (statusFilter === 'cancelled' && (row.status !== 'cancelled' || row.isArchived)) return false
      if (statusFilter === 'archived' && !row.isArchived) return false
      if (recruiterFilter && row.owner_recruiter_id !== recruiterFilter && row.created_by_recruiter_id !== recruiterFilter) return false
      if (dateFrom && (!row.date_opened || row.date_opened < dateFrom)) return false
      if (dateTo && (!row.date_opened || row.date_opened > dateTo)) return false
      if (query) {
        const haystack = [row.reqId, row.vessel_name, row.customer_name, row.rankName, row.vesselTypeName, row.recruiterName]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [rows, statusFilter, recruiterFilter, search, dateFrom, dateTo])

  const statusCounts = useMemo(() => ({
    open: rows.filter((row) => row.status === 'open' && !row.isArchived).length,
    closed: rows.filter((row) => row.status === 'closed' && !row.isArchived).length,
    cancelled: rows.filter((row) => row.status === 'cancelled' && !row.isArchived).length,
    archived: rows.filter((row) => row.isArchived).length,
    all: rows.length,
  }), [rows])

  const openRows = rows.filter((row) => row.status === 'open' && !row.isArchived)
  const totalOpenPositions = openRows.reduce((sum, row) => sum + row.openPositions, 0)
  const overdueCount = openRows.filter((row) => row.onTimeStatus === 'Overdue').length
  const joinedTotal = filteredRows.reduce((sum, row) => sum + row.joinedCount, 0)

  const exportCsv = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await runExport()
    } catch (error) {
      console.error('Requirements export failed:', error)
      setExportError(error?.message || 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const runExport = async () => {
    await logRecruiterExport({
      reportType: 'requirements_tracker',
      exportFormat: 'csv',
      rowIds: filteredRows.map((row) => row.id),
      rowCount: filteredRows.length,
      filters: { statusFilter, recruiterFilter, search, dateFrom, dateTo },
    })
    await downloadCsvReport({
      filename: `requirements-tracker-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Req ID', value: (row) => row.reqId },
        { label: 'Date Opened', value: (row) => row.date_opened || '' },
        { label: 'Date Closed', value: (row) => row.date_closed || '' },
        { label: 'Vessel', value: (row) => row.vessel_name || '' },
        { label: 'Vessel Type', value: (row) => row.vesselTypeName },
        { label: 'Rank', value: (row) => row.rankName },
        { label: 'Positions Required', value: (row) => row.positions_required },
        { label: 'Candidates Joined', value: (row) => row.joinedCount },
        { label: 'Open Positions', value: (row) => row.openPositions },
        { label: 'Requirement Status', value: (row) => row.status },
        { label: 'Days Open', value: (row) => row.daysOpen ?? '' },
        { label: 'Days to Close', value: (row) => row.daysToClose ?? '' },
        { label: 'Target Days', value: (row) => row.targetDays ?? '' },
        { label: 'On-Time Status', value: (row) => row.onTimeStatus },
        { label: 'Owner/Recruiter', value: (row) => row.recruiterName },
        { label: 'Customer', value: (row) => row.customer_name || '' },
        { label: 'Remarks', value: (row) => row.latestRemark },
      ],
      rows: filteredRows,
    })
  }

  if (permLoading || tracker.loading) {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Requirements"
          title="Requirements tracker"
          description="Every approved requirement with joins, open positions, ageing, and on-time delivery — calculated live. A requirement only closes when all required positions have joined."
          actions={(
            <div className="flex flex-wrap gap-3">
              {canExportData() ? (
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting…' : 'Export CSV'}
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
              <Link
                to="/recruiter/workspace"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Add requirement
              </Link>
            </div>
          )}
        />

        {exportError ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {exportError}
          </div>
        ) : null}

        {tracker.error ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
            <p className="font-semibold">Could not load the requirements tracker.</p>
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
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open requirements" value={statusCounts.open} icon={ClipboardList} tone="accent" hint="Approved requirements still being worked." />
          <StatCard label="Open positions" value={totalOpenPositions} icon={Ship} tone="warning" hint="Positions still to be filled across open requirements." />
          <StatCard label="Candidates joined" value={joinedTotal} icon={Users} tone="success" hint="Joined candidates across the filtered rows." />
          <StatCard label="Overdue requirements" value={overdueCount} icon={CheckCircle2} tone={overdueCount > 0 ? 'warning' : 'success'} hint="Open requirements past their target days." />
        </div>

        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl
                options={STATUS_FILTERS.map((option) => ({ ...option, count: statusCounts[option.value] }))}
                value={statusFilter}
                onChange={setStatusFilter}
                size="sm"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Search</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Req ID, vessel, rank, customer…"
                  className="w-56 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Recruiter</span>
                <select
                  value={recruiterFilter}
                  onChange={(event) => setRecruiterFilter(event.target.value)}
                  className="w-44 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
                <span className="mb-1 block text-xs font-medium text-slate-500">Opened from</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Opened to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No requirements match"
              description="Adjust the filters, or add a new requirement from the Workspace."
            />
          ) : (
            <div className="tracker-table-wrap max-h-[38rem] overflow-y-auto">
              <table className="tracker-table">
                <thead>
                  <tr>
                    <th>Req ID</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Vessel</th>
                    <th>Type</th>
                    <th>Rank</th>
                    <th className="tracker-cell--num">Required</th>
                    <th className="tracker-cell--num">Joined</th>
                    <th className="tracker-cell--num">Open</th>
                    <th>Status</th>
                    <th className="tracker-cell--num">Days open</th>
                    <th className="tracker-cell--num">Target</th>
                    <th>On-time</th>
                    <th>Recruiter</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const statusMeta = getStatusMeta(REQUIREMENT_STATUS_META, row.status)
                    return (
                      <tr key={row.id}>
                        <td className="tracker-cell--primary tracker-cell--nowrap">
                          <Link to={`/recruiter/workspace/requirements/${row.id}`} state={{ from: `${location.pathname}${location.search}` }} className="text-blue-700 hover:underline">
                            {row.reqId}
                          </Link>
                          {row.isArchived ? (
                            <span className="tracker-pill ml-2 bg-slate-200 text-slate-600">Archived</span>
                          ) : null}
                        </td>
                        <td className="tracker-cell--nowrap">{formatDate(row.date_opened)}</td>
                        <td className="tracker-cell--nowrap tracker-cell--muted">{row.date_closed ? formatDate(row.date_closed) : '—'}</td>
                        <td>{row.vessel_name || '—'}</td>
                        <td className="tracker-cell--nowrap">{row.vesselTypeName}</td>
                        <td className="tracker-cell--nowrap">{row.rankName}</td>
                        <td className="tracker-cell--num">{row.positions_required}</td>
                        <td className="tracker-cell--num">{row.joinedCount}</td>
                        <td className={`tracker-cell--num ${row.openPositions > 0 ? 'font-semibold text-amber-700' : 'text-emerald-700'}`}>
                          {row.openPositions}
                        </td>
                        <td>
                          <span className={`tracker-pill ${statusMeta.className}`}>{statusMeta.label}</span>
                        </td>
                        <td className="tracker-cell--num">{row.daysOpen ?? '—'}</td>
                        <td className="tracker-cell--num tracker-cell--muted">{row.targetDays ?? '—'}</td>
                        <td>
                          <span className={`tracker-pill ${ON_TIME_BADGE_CLASSES[row.onTimeStatus] || ON_TIME_BADGE_CLASSES['—']}`}>
                            {row.onTimeStatus}
                          </span>
                        </td>
                        <td className="tracker-cell--nowrap">{row.recruiterName}</td>
                        <td className="max-w-[16rem] tracker-cell--muted">
                          <span className="line-clamp-2">{row.latestRemark || row.closure_reason || '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            {filteredRows.length} requirement{filteredRows.length === 1 ? '' : 's'} shown · days to close for closed rows: {filteredRows.filter((row) => row.daysToClose != null).length > 0
              ? formatDays(
                  filteredRows
                    .filter((row) => row.daysToClose != null)
                    .reduce((sum, row) => sum + row.daysToClose, 0) /
                    filteredRows.filter((row) => row.daysToClose != null).length
                ) + ' average'
              : 'no closed rows in view'}
          </p>
        </section>
        </>
        )}
      </main>
    </div>
  )
}
