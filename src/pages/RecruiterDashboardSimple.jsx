import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import useKpiTrackerData from '../hooks/useKpiTrackerData'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import RequirementProgressTable from '../components/recruiter/RequirementProgressTable'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import {
  buildCandidateFunnelRows,
  buildRequirementTrackerRows,
  computeDashboardMetrics,
  lastActivityLabel,
  STAGE_BADGE_CLASSES,
  toDateOnly,
} from '../utils/kpiTracker'
import { formatDate } from './recruiterDashboardUtils'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Loader2,
  RefreshCcw,
  UserRoundSearch,
  Users,
} from 'lucide-react'

const FOLLOW_UP_DAYS = 7
const SCHEDULE_DAYS = 14

function SectionHeader({ icon: Icon, title, subtitle, link }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-card bg-raised text-fg-secondary">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-fg-secondary">{subtitle}</p> : null}
        </div>
      </div>
      {link ? (
        <Link to={link.to} className="text-sm font-medium text-accent-text hover:underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  )
}

function eventKind(event) {
  const type = String(event.event_type || '').toLowerCase()
  if (type.includes('test')) return 'Test'
  if (type.includes('interview')) return 'Interview'
  return 'Event'
}

export default function RecruiterDashboardSimple() {
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const { role, loading: permLoading } = usePermissions()
  const tracker = useKpiTrackerData({ enabled: !permLoading })
  const isManager = role === 'Master Recruiter'
  // Managers see the whole team by default and can narrow to one recruiter;
  // everyone else always sees their own work.
  const [managerFilter, setManagerFilter] = useState('')
  const scopeId = isManager ? managerFilter : (user?.id || '__none__')

  const requirementRows = useMemo(() => buildRequirementTrackerRows({
    ...tracker.data,
    remarks: tracker.data.requirementRemarks,
  }), [tracker.data])
  const candidateRows = useMemo(() => buildCandidateFunnelRows({
    ...tracker.data,
    notes: tracker.data.prospectNotes,
  }), [tracker.data])

  const scopedRequirements = useMemo(() => (
    scopeId ? requirementRows.filter((row) => row.ownerId === scopeId) : requirementRows
  ), [requirementRows, scopeId])
  const scopedCandidates = useMemo(() => (
    scopeId ? candidateRows.filter((row) => row.created_by_recruiter_id === scopeId) : candidateRows
  ), [candidateRows, scopeId])

  const metrics = useMemo(() => computeDashboardMetrics({
    requirementRows: scopedRequirements,
    candidateRows: scopedCandidates,
    recruiters: [],
  }), [scopedRequirements, scopedCandidates])

  const overdueCount = metrics.requirementProgress.filter((row) => row.onTimeStatus === 'Overdue').length

  // Candidates still in the pipeline with no activity for more than a week.
  const followUps = useMemo(() => {
    const now = new Date()
    return scopedCandidates
      .filter((row) => row.inActivePipeline)
      .map((row) => ({ row, activity: lastActivityLabel(row.last_activity_at || row.updated_at || row.created_at, now) }))
      .filter(({ activity }) => activity.days != null && activity.days > FOLLOW_UP_DAYS)
      .sort((a, b) => b.activity.days - a.activity.days)
  }, [scopedCandidates])

  // Interviews and tests in the next two weeks. "Mine" = I scheduled it or I
  // handle the application it belongs to.
  const upcoming = useMemo(() => {
    const today = toDateOnly(new Date())
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + SCHEDULE_DAYS)
    const applicationById = new Map(tracker.data.applications.map((application) => [application.id, application]))
    return tracker.data.scheduledEvents
      .filter((event) => !['cancelled', 'completed'].includes(event.status))
      .filter((event) => {
        const date = toDateOnly(event.scheduled_date)
        return date && date >= today && date <= horizon
      })
      .filter((event) => {
        if (!scopeId) return true
        const application = applicationById.get(event.application_id)
        return event.scheduled_by === scopeId || application?.handling_recruiter_id === scopeId
      })
      .map((event) => ({ ...event, application: applicationById.get(event.application_id) || null }))
      .sort((a, b) => `${a.scheduled_date} ${a.scheduled_time || ''}`.localeCompare(`${b.scheduled_date} ${b.scheduled_time || ''}`))
  }, [tracker.data.scheduledEvents, tracker.data.applications, scopeId])

  const scopeName = isManager && managerFilter
    ? (tracker.data.recruiters.find((recruiter) => recruiter.id === managerFilter)?.full_name || 'Recruiter')
    : null
  const subtitle = isManager
    ? (scopeName ? `${scopeName}'s work` : 'Whole team')
    : 'Your requirements, follow-ups and schedule'

  const recruiterParam = scopeId ? `&recruiter=${encodeURIComponent(scopeId)}` : ''

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
          title="Dashboard"
          actions={(
            <div className="flex flex-wrap gap-3">
              <Link
                to="/recruiter/kpi"
                className="inline-flex items-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover"
              >
                <ArrowRight className="h-4 w-4" />
                Open KPI
              </Link>
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
            {isManager ? (
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-fg-muted">Recruiter</span>
                <select
                  value={managerFilter}
                  onChange={(event) => setManagerFilter(event.target.value)}
                  className="w-56 rounded-control border border-line bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">Whole team</option>
                  {tracker.data.recruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.full_name || recruiter.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="pb-2 text-sm text-fg-secondary">{subtitle}</p>
          </div>
        </PageHeader>

        {tracker.error ? (
          <div className="mt-6 rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
            {tracker.error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <StatCard label="Open requirements" value={metrics.openRequirementsCount} icon={ClipboardList} tone="accent" to={`/recruiter/requirements?status=open${recruiterParam}`} />
          <StatCard label="Overdue" value={overdueCount} icon={AlertTriangle} tone={overdueCount > 0 ? 'warning' : 'default'} to={`/recruiter/requirements?status=open${recruiterParam}`} />
          <StatCard label="Open positions" value={metrics.openPositions} icon={Users} tone="warning" to={`/recruiter/requirements?status=open${recruiterParam}`} />
          <StatCard label="Follow-ups due" value={followUps.length} icon={UserRoundSearch} tone={followUps.length > 0 ? 'warning' : 'default'} to={`/recruiter/candidates?view=active${recruiterParam}`} />
          <StatCard label={`Interviews and tests, ${SCHEDULE_DAYS} days`} value={upcoming.length} icon={CalendarDays} tone="accent" to="/recruiter/calendar" />
        </div>

        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <SectionHeader
            icon={ClipboardList}
            title={isManager && !managerFilter ? 'Requirements' : 'My requirements'}
            subtitle="Most at risk first."
            link={{ to: '/recruiter/requirements', label: 'All requirements' }}
          />
          <RequirementProgressTable
            rows={metrics.requirementProgress}
            limit={8}
            showOwner={isManager && !managerFilter}
            emptyTitle="No open requirements"
            emptyDescription={isManager && !managerFilter ? 'Every requirement is closed or cancelled.' : 'No open requirements are assigned here.'}
          />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="recruiter-panel p-5 sm:p-6">
            <SectionHeader
              icon={UserRoundSearch}
              title="Follow-ups"
              subtitle={`Candidates in the pipeline with no activity for over ${FOLLOW_UP_DAYS} days.`}
              link={{ to: '/recruiter/candidates', label: 'All candidates' }}
            />
            {followUps.length === 0 ? (
              <EmptyState icon={UserRoundSearch} title="Nothing to chase" description="Every active candidate has had recent activity." />
            ) : (
              <ul className="divide-y divide-line">
                {followUps.slice(0, 8).map(({ row, activity }) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/recruiter/workspace/prospects/${row.id}`}
                        state={{ from: `${location.pathname}${location.search}` }}
                        className="font-medium text-fg hover:text-accent-text hover:underline"
                      >
                        {row.name}
                      </Link>
                      <div className="mt-0.5 truncate text-xs text-fg-muted">
                        {row.rankName} · {row.requirementLabel}{isManager && !managerFilter ? ` · ${row.recruiterName}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-3">
                      <span className={`tracker-pill ${STAGE_BADGE_CLASSES[row.stage] || ''}`}>{row.stage}</span>
                      <span className="w-24 text-right text-sm font-medium text-warning">{activity.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {followUps.length > 8 ? (
              <p className="mt-3 text-xs text-fg-muted">Showing the 8 longest-waiting of {followUps.length}.</p>
            ) : null}
          </section>

          <section className="recruiter-panel p-5 sm:p-6">
            <SectionHeader
              icon={CalendarDays}
              title="Interviews and tests"
              subtitle={`Next ${SCHEDULE_DAYS} days.`}
              link={{ to: '/recruiter/calendar', label: 'Calendar' }}
            />
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nothing scheduled" description={`No interviews or tests in the next ${SCHEDULE_DAYS} days.`} />
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.slice(0, 8).map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-fg">{event.event_title || eventKind(event)}</div>
                      <div className="mt-0.5 text-xs text-fg-muted">
                        {formatDate(event.scheduled_date)}{event.scheduled_time ? ` · ${String(event.scheduled_time).slice(0, 5)}` : ''}
                        {event.platform ? ` · ${event.platform}` : ''}
                      </div>
                    </div>
                    <span className={`tracker-pill flex-none ${eventKind(event) === 'Test' ? 'bg-progress-soft text-progress' : 'bg-accent-soft text-accent-text'}`}>
                      {eventKind(event)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
