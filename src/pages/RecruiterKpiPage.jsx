import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  Search,
  Users,
} from 'lucide-react'
import { downloadCsvReport, logRecruiterExport } from '../services/recruiterReportExportService'
import { formatDateTime } from './recruiterDashboardUtils'

function isWithinRange(value, from, to) {
  if (!from && !to) return true
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  if (from && date < new Date(`${from}T00:00:00`)) return false
  if (to && date > new Date(`${to}T23:59:59`)) return false
  return true
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export default function RecruiterKpiPage() {
  const { user, profile, signOut } = useAuth()
  const { loading: permLoading } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recruiters, setRecruiters] = useState([])
  const [requirements, setRequirements] = useState([])
  const [prospects, setProspects] = useState([])
  const [junctions, setJunctions] = useState([])
  const [scheduledEvents, setScheduledEvents] = useState([])
  const [recentExports, setRecentExports] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [recruiterFilter, setRecruiterFilter] = useState('')

  const recruiterOptions = useMemo(() => {
    return [
      { value: '', label: 'All recruiters' },
      ...recruiters.map((recruiter) => ({
        value: recruiter.id,
        label: `${recruiter.full_name || recruiter.email || recruiter.id}${recruiter.role_name ? ` · ${recruiter.role_name}` : ''}`,
      })),
    ]
  }, [recruiters])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          recruitersResult,
          requirementsResult,
          prospectsResult,
          junctionsResult,
          scheduledEventsResult,
          exportsResult,
        ] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, role_name, user_type').eq('user_type', 'recruiter').order('full_name'),
          supabase
            .from('requirements')
            .select('id, req_id_display, date_opened, date_closed, vessel_name, vessel_type_id, rank_id, positions_required, target_days, customer_name, status, owner_recruiter_id, created_by_recruiter_id, archived_at, deleted_at, created_at, updated_at')
            .order('updated_at', { ascending: false }),
          supabase
            .from('prospects')
            .select('id, name, status, first_contacted_at, invited_at, claimed_at, archived_at, deleted_at, created_by_recruiter_id, last_activity_at, created_at, updated_at')
            .order('last_activity_at', { ascending: false }),
          supabase
            .from('prospect_requirements')
            .select('id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at, version')
            .order('updated_at', { ascending: false }),
          supabase
            .from('scheduled_events')
            .select('id, event_type, event_title, platform, location_type, scheduled_date, scheduled_time, status, application_id, created_at')
            .gte('scheduled_date', new Date().toISOString().slice(0, 10))
            .order('scheduled_date', { ascending: true })
            .limit(20),
          supabase.rpc('get_recent_exports', { p_limit: 10 }),
        ])

        if (cancelled) return

        const dataOrThrow = (result) => {
          if (result.error) throw result.error
          return result.data || []
        }

        setRecruiters(dataOrThrow(recruitersResult))
        setRequirements(dataOrThrow(requirementsResult))
        setProspects(dataOrThrow(prospectsResult))
        setJunctions(dataOrThrow(junctionsResult))
        setScheduledEvents(dataOrThrow(scheduledEventsResult))
        setRecentExports(exportsResult.error ? [] : exportsResult.data || [])
      } catch (loadError) {
        if (cancelled) return
        console.error('Failed to load KPI page:', loadError)
        setError(loadError?.message || 'Failed to load KPI page')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!permLoading) {
      load()
    }

    return () => {
      cancelled = true
    }
  }, [permLoading, user?.id])

  const filteredRequirements = useMemo(() => {
    return requirements.filter((requirement) => {
      const recruiterId = requirement.created_by_recruiter_id || requirement.owner_recruiter_id
      if (recruiterFilter && recruiterId !== recruiterFilter) return false
      return isWithinRange(requirement.created_at, dateFrom, dateTo) || isWithinRange(requirement.updated_at, dateFrom, dateTo)
    })
  }, [dateFrom, dateTo, recruiterFilter, requirements])

  const filteredProspects = useMemo(() => {
    return prospects.filter((prospect) => {
      if (recruiterFilter && prospect.created_by_recruiter_id !== recruiterFilter) return false
      return isWithinRange(prospect.first_contacted_at || prospect.created_at, dateFrom, dateTo) || isWithinRange(prospect.last_activity_at || prospect.updated_at, dateFrom, dateTo)
    })
  }, [dateFrom, dateTo, recruiterFilter, prospects])

  const filteredJunctions = useMemo(() => {
    return junctions.filter((junction) => {
      if (recruiterFilter && junction.assigned_by_recruiter_id !== recruiterFilter && junction.last_transition_by_recruiter_id !== recruiterFilter) return false
      return isWithinRange(junction.created_at, dateFrom, dateTo) || isWithinRange(junction.updated_at, dateFrom, dateTo)
    })
  }, [dateFrom, dateTo, recruiterFilter, junctions])

  const openRequirements = filteredRequirements.filter((requirement) => requirement.status === 'open' && !requirement.archived_at && !requirement.deleted_at)
  const closedRequirements = filteredRequirements.filter((requirement) => requirement.status === 'closed' && !requirement.archived_at && !requirement.deleted_at)
  const joinedCount = filteredJunctions.filter((junction) => junction.status === 'joined').length
  const positionsRequired = filteredRequirements.reduce((sum, requirement) => sum + toNumber(requirement.positions_required), 0)
  const openPositions = Math.max(
    positionsRequired - filteredJunctions.filter((junction) => junction.status === 'joined').length,
    0
  )
  const requirementClosureRate = filteredRequirements.length === 0 ? 0 : closedRequirements.length / filteredRequirements.length
  const candidatesContactedToday = filteredProspects.filter((prospect) => {
    const today = new Date().toISOString().slice(0, 10)
    return (prospect.first_contacted_at || '').slice(0, 10) === today
  }).length
  const candidatesJoinedToday = filteredJunctions.filter((junction) => {
    const today = new Date().toISOString().slice(0, 10)
    return junction.status === 'joined' && (junction.joined_at || '').slice(0, 10) === today
  }).length

  const topFiveAttentionItems = [
    ...openRequirements.slice(0, 2).map((requirement) => ({
      key: `req-${requirement.id}`,
      label: requirement.req_id_display,
      detail: `Open positions: ${Math.max(toNumber(requirement.positions_required) - filteredJunctions.filter((junction) => junction.requirement_id === requirement.id && junction.status === 'joined').length, 0)}`,
      tone: 'bg-amber-100 text-amber-700',
    })),
    ...filteredProspects
      .filter((prospect) => prospect.archived_at || prospect.deleted_at || prospect.status === 'rejected')
      .slice(0, 2)
      .map((prospect) => ({
        key: `prospect-${prospect.id}`,
        label: prospect.name,
        detail: 'Candidate is archived, deleted, or rejected.',
        tone: 'bg-slate-100 text-slate-700',
      })),
  ].slice(0, 5)

  const exportSummary = async () => {
    await logRecruiterExport({
      reportType: 'kpi_summary',
      exportFormat: 'csv',
      rowIds: [
        ...filteredRequirements.map((row) => row.id),
        ...filteredProspects.map((row) => row.id),
        ...filteredJunctions.map((row) => row.id),
      ],
      rowCount: filteredRequirements.length + filteredProspects.length + filteredJunctions.length,
      filters: {
        dateFrom,
        dateTo,
        recruiterFilter,
      },
    })

    await downloadCsvReport({
      filename: `kpi-summary-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Metric', value: (row) => row.metric },
        { label: 'Value', value: (row) => row.value },
        { label: 'Notes', value: (row) => row.notes },
      ],
      rows: [
        { metric: 'Open requirements', value: openRequirements.length, notes: 'Active requirement rows' },
        { metric: 'Closed requirements', value: closedRequirements.length, notes: 'Completed requirement rows' },
        { metric: 'Open positions', value: openPositions, notes: 'Positions still needing candidates' },
        { metric: 'Joined vs required', value: `${joinedCount} / ${positionsRequired}`, notes: 'Joined candidates against required positions' },
        { metric: 'Requirement closure %', value: `${Math.round(requirementClosureRate * 100)}%`, notes: 'Closed requirements divided by filtered requirements' },
        { metric: 'Candidates contacted today', value: candidatesContactedToday, notes: 'Prospects first contacted today' },
        { metric: 'Candidates joined today', value: candidatesJoinedToday, notes: 'Pipeline rows marked joined today' },
      ],
    })
  }

  if (permLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="KPI"
          title="Recruiter performance and reporting"
          description="Track requirement health, candidate flow, and recruiter activity without mixing it into the daily workspace."
          actions={(
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportSummary}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Export summary
              </button>
              <Link
                to="/recruiter/calendar"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <CalendarDays className="h-4 w-4" />
                Calendar
              </Link>
            </div>
          )}
        >
          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-gray-700">Date from</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-gray-700">Date to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-gray-700">Recruiter</span>
              <select
                value={recruiterFilter}
                onChange={(event) => setRecruiterFilter(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {recruiterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Report date</p>
              <p className="mt-1">{formatDateTime(new Date().toISOString())}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Recent exports</p>
              <p className="mt-1">{recentExports.length} logged exports</p>
            </div>
          </div>
        </PageHeader>

        {error ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Open requirements" value={openRequirements.length} icon={ClipboardList} tone="info" hint="Requirements still looking for candidates." />
          <StatCard label="Closed requirements" value={closedRequirements.length} icon={CheckCircle2} tone="success" hint="Rows already resolved or completed." />
          <StatCard label="Open positions" value={openPositions} icon={ArrowRight} tone="warning" hint="Remaining positions across filtered requirements." />
          <StatCard label="Joined vs required" value={`${joinedCount} / ${positionsRequired}`} icon={Users} tone="accent" hint="Joined candidates compared with positions required." />
          <StatCard label="Requirement closure %" value={`${Math.round(requirementClosureRate * 100)}%`} icon={CheckCircle2} tone="success" hint="Closed requirements divided by the filtered requirement set." />
          <StatCard label="Candidates contacted today" value={candidatesContactedToday} icon={Search} tone="info" hint="Today-only metric; the date filters affect the rest of the page, not this count." />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Needs attention</h2>
                <p className="mt-1 text-sm text-slate-600">A compact summary of items that need recruiter follow-up.</p>
              </div>
            </div>
            <div className="space-y-3">
              {topFiveAttentionItems.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Nothing urgent"
                  description="The filtered view does not currently surface any obvious exceptions."
                />
              ) : topFiveAttentionItems.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{item.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.tone}`}>
                      Review
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Upcoming schedule</h2>
                <p className="mt-1 text-sm text-slate-600">The next events the team can open from KPI.</p>
              </div>
            </div>

            <div className="space-y-3">
              {scheduledEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No upcoming events"
                  description="Create or sync events to populate the schedule section."
                />
              ) : scheduledEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{event.event_title || event.event_type}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {event.scheduled_date} {event.scheduled_time || ''}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {event.platform || 'Scheduled event'}
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                      Upcoming
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Candidate flow</h2>
                <p className="mt-1 text-sm text-slate-600">Quick counts for recruiter movement through the pipeline.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-medium text-slate-900">Prospects touched</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{filteredProspects.length}</div>
                <div className="mt-1 text-xs text-slate-500">Prospects within the selected date and recruiter filters.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-medium text-slate-900">Candidates joined today</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{candidatesJoinedToday}</div>
                <div className="mt-1 text-xs text-slate-500">Today-only metric; the date filters affect the rest of the page, not this count.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-medium text-slate-900">Pipeline rows</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{filteredJunctions.length}</div>
                <div className="mt-1 text-xs text-slate-500">All active prospect-to-requirement links in scope.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-medium text-slate-900">Active recruiters</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{recruiters.length}</div>
                <div className="mt-1 text-xs text-slate-500">Recruiter accounts surfaced for attribution and filtering.</div>
              </div>
            </div>
          </section>

          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Recent exports</h2>
                <p className="mt-1 text-sm text-slate-600">The latest audit rows from the KPI/export pipeline.</p>
              </div>
            </div>
            <div className="space-y-3">
              {recentExports.length === 0 ? (
                <EmptyState
                  icon={Download}
                  title="No exports yet"
                  description="Run an export to populate this list."
                />
              ) : recentExports.map((row) => (
                <div key={row.id || `${row.created_at}-${row.report_type}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{row.report_type}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.export_format?.toUpperCase()} · {formatDateTime(row.created_at)}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {row.row_count || 0} rows
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
