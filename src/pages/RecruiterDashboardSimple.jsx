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
  Loader2,
  Search,
  Users,
} from 'lucide-react'
import { formatRelativeTime } from './recruiterDashboardUtils'

function daysBetween(left, right) {
  if (!left || !right) return null
  const start = new Date(left)
  const end = new Date(right)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return Math.floor((end - start) / (1000 * 60 * 60 * 24))
}

export default function RecruiterDashboardSimple() {
  const { user, profile, signOut } = useAuth()
  const { loading: permLoading } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requirements, setRequirements] = useState([])
  const [prospects, setProspects] = useState([])
  const [junctions, setJunctions] = useState([])
  const [scheduledEvents, setScheduledEvents] = useState([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          requirementsResult,
          prospectsResult,
          junctionsResult,
          scheduledEventsResult,
        ] = await Promise.all([
          supabase
            .from('requirements')
            .select('id, req_id_display, date_opened, positions_required, target_days, status, created_at, updated_at, archived_at, deleted_at')
            .order('updated_at', { ascending: false }),
          supabase
            .from('prospects')
            .select('id, name, status, first_contacted_at, last_activity_at, archived_at, deleted_at, created_at, updated_at')
            .order('last_activity_at', { ascending: false }),
          supabase
            .from('prospect_requirements')
            .select('id, prospect_id, requirement_id, status, joined_at, withdrawn_at, created_at, updated_at, version')
            .order('updated_at', { ascending: false }),
          supabase
            .from('scheduled_events')
            .select('id, event_type, event_title, platform, scheduled_date, scheduled_time, status, created_at')
            .gte('scheduled_date', new Date().toISOString().slice(0, 10))
            .order('scheduled_date', { ascending: true })
            .limit(12),
        ])

        if (cancelled) return

        const takeData = (result) => {
          if (result.error) throw result.error
          return result.data || []
        }

        setRequirements(takeData(requirementsResult))
        setProspects(takeData(prospectsResult))
        setJunctions(takeData(junctionsResult))
        setScheduledEvents(takeData(scheduledEventsResult))
      } catch (loadError) {
        if (cancelled) return
        console.error('Failed to load dashboard:', loadError)
        setError(loadError?.message || 'Failed to load dashboard')
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

  const openRequirements = useMemo(() => requirements.filter((requirement) => requirement.status === 'open' && !requirement.archived_at && !requirement.deleted_at), [requirements])
  const closedRequirements = useMemo(() => requirements.filter((requirement) => requirement.status === 'closed' && !requirement.archived_at && !requirement.deleted_at), [requirements])
  const activeCandidates = useMemo(() => prospects.filter((prospect) => !prospect.archived_at && !prospect.deleted_at), [prospects])
  const openPositions = useMemo(() => {
    return openRequirements.reduce((sum, requirement) => {
      const joined = junctions.filter((junction) => junction.requirement_id === requirement.id && junction.status === 'joined').length
      return sum + Math.max((Number(requirement.positions_required) || 0) - joined, 0)
    }, 0)
  }, [junctions, openRequirements])

  const attentionItems = useMemo(() => {
    const overdueRequirements = openRequirements
      .filter((requirement) => {
        const ageDays = daysBetween(requirement.date_opened, new Date())
        return Number.isFinite(ageDays) && ageDays > Number(requirement.target_days || 0)
      })
      .slice(0, 2)
      .map((requirement) => ({
        id: `requirement-${requirement.id}`,
        title: `${requirement.req_id_display} is overdue`,
        detail: `Open for ${daysBetween(requirement.date_opened, new Date())} days against a target of ${requirement.target_days} days.`,
      }))

    const staleCandidates = activeCandidates
      .filter((candidate) => {
        const ageDays = daysBetween(candidate.last_activity_at || candidate.created_at, new Date())
        return Number.isFinite(ageDays) && ageDays > 7
      })
      .slice(0, 2)
      .map((candidate) => ({
        id: `candidate-${candidate.id}`,
        title: `${candidate.name} needs follow-up`,
        detail: `Last activity was ${formatRelativeTime(candidate.last_activity_at || candidate.created_at)}.`,
      }))

    return [...overdueRequirements, ...staleCandidates].slice(0, 4)
  }, [activeCandidates, openRequirements])

  const upcomingEvents = scheduledEvents.slice(0, 6)

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
          eyebrow="Dashboard"
          title="Recruiter executive snapshot"
          description="A simple overview of what needs attention right now, without the old tabbed workspace clutter."
          actions={(
            <div className="flex flex-wrap gap-3">
              <Link
                to="/recruiter/kpi"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <ArrowRight className="h-4 w-4" />
                Open KPI
              </Link>
              <Link
                to="/recruiter/workspace"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Workspace
              </Link>
            </div>
          )}
        >
          <p className="mt-4 max-w-3xl text-sm text-slate-600">
            What is happening across recruitment right now? This page keeps the answer short and high-level, with the detailed KPI work pushed into the dedicated page.
          </p>
        </PageHeader>

        {error ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Open requirements" value={openRequirements.length} icon={ClipboardList} tone="info" hint="Requirements still asking for candidates." />
          <StatCard label="Open positions" value={openPositions} icon={Users} tone="warning" hint="Remaining slots on active requirements." />
          <StatCard label="Active candidates" value={activeCandidates.length} icon={Search} tone="success" hint="Candidates not archived or deleted." />
          <StatCard label="Closed requirements" value={closedRequirements.length} icon={CheckCircle2} tone="success" hint="Completed or closed requirement rows." />
          <StatCard label="Upcoming events" value={upcomingEvents.length} icon={CalendarDays} tone="accent" hint="Interviews, tests, and schedule items." />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="recruiter-panel p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Needs attention</h2>
                <p className="mt-1 text-sm text-slate-600">The highest-priority items the team should review first.</p>
              </div>
            </div>
            <div className="space-y-3">
              {attentionItems.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No urgent items"
                  description="Nothing in the current snapshot is obviously overdue or stale."
                />
              ) : attentionItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
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
                <p className="mt-1 text-sm text-slate-600">The next scheduled items visible from the dashboard.</p>
              </div>
            </div>
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No upcoming schedule"
                  description="Schedule events will appear here once they are created."
                />
              ) : upcomingEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{event.event_title || event.event_type}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {event.scheduled_date} {event.scheduled_time || ''}
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
      </main>
    </div>
  )
}
