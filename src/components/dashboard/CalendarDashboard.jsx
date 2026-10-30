import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  User,
  Video
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import PageHeader from '../ui/PageHeader'

const EVENT_TYPE_CONFIG = {
  interview: {
    icon: Video,
    badgeColor: 'bg-accent-soft text-accent-text',
    label: 'Interview',
    markerColor: 'bg-accent-fill'
  },
  test: {
    icon: FileText,
    badgeColor: 'bg-progress-soft text-progress',
    label: 'Test',
    markerColor: 'bg-progress'
  }
}

const CALENDAR_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date, count) {
  const next = new Date(date)
  next.setDate(next.getDate() + count)
  return next
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00:00'}`)
}

function formatAgendaDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
}

function getTimeUntil(dateString, timeString) {
  const now = new Date()
  const eventDate = combineDateTime(dateString, timeString)

  if (!eventDate) return { text: 'Date TBD', isPast: false }

  const diffMs = eventDate - now
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (diffMs < 0) return { text: 'Past event', isPast: true }
  if (diffDays === 0 && diffHours <= 0) return { text: 'Starting soon', isToday: true, isPast: false }
  if (diffDays === 0) return { text: `In ${diffHours}h`, isToday: true, isPast: false }
  if (diffDays === 1) return { text: 'Tomorrow', isPast: false }
  return { text: `In ${diffDays} days`, isPast: false }
}

export default function CalendarDashboard() {
  const { user } = useAuth()
  const { role, loading: permLoading } = usePermissions(user)

  const today = useMemo(() => startOfDay(new Date()), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedType, setSelectedType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeMonth, setActiveMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()))
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

  const fetchScheduledEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: eventsError } = await supabase
        .from('scheduled_events')
        .select(`
          *,
          applications (
            reference_number,
            applied_rank
          ),
          profiles!scheduled_events_scheduled_by_fkey (
            full_name,
            email
          )
        `)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })

      if (eventsError) throw eventsError

      setEvents(data || [])
      setLastSyncedAt(new Date())
    } catch (err) {
      console.error('Error fetching scheduled events:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!permLoading) {
      fetchScheduledEvents()
    }
  }, [permLoading])

  const normalizedRole = role?.toLowerCase().replace(/\s+/g, '_')
  const hasAccess = normalizedRole === 'recruiter' || normalizedRole === 'master_recruiter'

  const filteredEvents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return events
      .map((event) => {
        const eventDate = combineDateTime(event.scheduled_date, event.scheduled_time)
        return {
          ...event,
          eventDate,
          dateKey: eventDate ? getDateKey(eventDate) : null
        }
      })
      .filter((event) => {
        if (!event.eventDate) return false
        if (selectedType !== 'all' && event.event_type !== selectedType) return false
        if (!query) return true

        const haystack = [
          event.event_title,
          event.event_description,
          event.applications?.reference_number,
          event.applications?.applied_rank,
          event.profiles?.full_name,
          event.profiles?.email,
          event.location_details,
          event.platform
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(query)
      })
  }, [events, searchTerm, selectedType])

  const monthEvents = useMemo(() => {
    return filteredEvents.filter(
      (event) =>
        event.eventDate &&
        event.eventDate.getFullYear() === activeMonth.getFullYear() &&
        event.eventDate.getMonth() === activeMonth.getMonth()
    )
  }, [filteredEvents, activeMonth])

  const eventCountsByDate = useMemo(() => {
    const counts = new Map()

    filteredEvents.forEach((event) => {
      if (!event.dateKey) return
      counts.set(event.dateKey, (counts.get(event.dateKey) || 0) + 1)
    })

    return counts
  }, [filteredEvents])

  const eventTypesByDate = useMemo(() => {
    const types = new Map()

    filteredEvents.forEach((event) => {
      if (!event.dateKey) return
      const existing = types.get(event.dateKey) || new Set()
      existing.add(event.event_type)
      types.set(event.dateKey, existing)
    })

    return types
  }, [filteredEvents])

  const selectedDateEvents = useMemo(() => {
    const selectedKey = getDateKey(selectedDate)
    return filteredEvents
      .filter((event) => event.dateKey === selectedKey)
      .sort((a, b) => a.eventDate - b.eventDate)
  }, [filteredEvents, selectedDate])

  const monthGridDays = useMemo(() => {
    const monthStart = startOfMonth(activeMonth)
    const gridStart = addDays(monthStart, -monthStart.getDay())

    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [activeMonth])

  const typeSummary = useMemo(() => {
    return {
      all: filteredEvents.length,
      interview: filteredEvents.filter((event) => event.event_type === 'interview').length,
      test: filteredEvents.filter((event) => event.event_type === 'test').length
    }
  }, [filteredEvents])

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-fg-secondary" />
          <p className="text-fg-secondary">Loading calendar workspace...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return <Navigate to="/recruiter/dashboard" replace />
  }

  if (error) {
    return (
      <div className="recruiter-panel p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-danger" />
          <div>
            <h3 className="mb-1 font-semibold text-danger">Error Loading Calendar</h3>
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={fetchScheduledEvents}
              className="mt-4 rounded-control bg-accent-fill px-4 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover"
            >
              Refresh events
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-2 py-2">
              <button
                onClick={() => setActiveMonth((current) => addMonths(current, -1))}
                className="rounded-card p-2 text-fg-secondary transition hover:bg-raised hover:text-fg"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[10rem] text-center text-sm font-semibold text-fg">
                {formatMonthLabel(activeMonth)}
              </span>
              <button
                onClick={() => setActiveMonth((current) => addMonths(current, 1))}
                className="rounded-card p-2 text-fg-secondary transition hover:bg-raised hover:text-fg"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={() => {
                setActiveMonth(startOfMonth(today))
                setSelectedDate(today)
              }}
              className="rounded-control border border-line bg-surface px-4 py-3 text-sm font-medium text-fg-secondary transition hover:border-line-input hover:text-fg"
            >
              Current month
            </button>
            <button
              onClick={fetchScheduledEvents}
              className="workspace-action-button"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="recruiter-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All events' },
              { id: 'interview', label: 'Interviews' },
              { id: 'test', label: 'Tests' }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedType(option.id)}
                className={`rounded-control px-4 py-2 text-sm font-medium transition ${
 selectedType === option.id
 ? 'border border-line-strong bg-raised text-fg'
 : 'border border-line bg-surface text-fg-secondary hover:border-line-input hover:text-fg'
 }`}
              >
                {option.label} ({typeSummary[option.id]})
              </button>
            ))}
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[20rem]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by applicant, rank, reference, platform..."
                className="w-full rounded-card border border-line bg-surface py-3 pl-11 pr-4 text-sm text-fg outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/30"
              />
            </div>
            <p className="text-sm text-fg-muted">
              {lastSyncedAt
                ? `Last synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Sync pending'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.85fr)]">
        <section className="recruiter-panel overflow-hidden">
          <div className="border-b border-line px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-fg">{formatMonthLabel(activeMonth)}</h2>
              </div>
              <div className="text-sm text-fg-muted">
                {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'} in this month
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-fg-muted">
              {CALENDAR_DAY_LABELS.map((label) => (
                <div key={label} className="py-2">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {monthGridDays.map((date) => {
                const dateKey = getDateKey(date)
                const isCurrentMonth = date.getMonth() === activeMonth.getMonth()
                const isSelected = dateKey === getDateKey(selectedDate)
                const isToday = dateKey === getDateKey(today)
                const eventCount = eventCountsByDate.get(dateKey) || 0
                const eventTypes = Array.from(eventTypesByDate.get(dateKey) || [])

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(startOfDay(date))}
                    className={`min-h-[4.5rem] rounded-card border p-2 text-left transition ${
 isSelected
 ? 'border-accent bg-raised text-fg '
 : isCurrentMonth
 ? 'border-line bg-surface text-fg hover:border-line-input '
 : 'border-line bg-raised text-fg-muted hover:border-line-input'
 }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
 isSelected
 ? 'bg-surface/15 text-fg'
 : isToday
 ? 'bg-accent-soft text-accent-text'
 : 'text-inherit'
 }`}
                      >
                        {date.getDate()}
                      </span>
                      {eventCount > 0 ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
 isSelected ? 'bg-surface/15 text-fg' : 'bg-raised text-fg-secondary'
 }`}
                        >
                          {eventCount}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-1.5">
                      {eventTypes.slice(0, 3).map((type) => (
                        <span
                          key={type}
                          className={`h-2.5 w-2.5 rounded-full ${
 isSelected ? 'bg-surface' : EVENT_TYPE_CONFIG[type]?.markerColor || 'bg-line-strong'
 }`}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="recruiter-panel overflow-hidden">
          <div className="border-b border-line px-5 py-5 sm:px-6">
            <h2 className="text-2xl font-semibold text-fg">{formatAgendaDate(selectedDate)}</h2>
            <p className="mt-2 text-sm text-fg-muted">
              {selectedDateEvents.length
                ? `${selectedDateEvents.length} scheduled ${selectedDateEvents.length === 1 ? 'event' : 'events'}`
                : 'No scheduled interviews or tests for this date.'}
            </p>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            {selectedDateEvents.length === 0 ? (
              <div className="rounded-control border border-dashed border-line-input bg-raised px-6 py-12 text-center">
                <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-fg-muted" />
                <h3 className="text-lg font-semibold text-fg">No events on this date</h3>
              </div>
            ) : (
              selectedDateEvents.map((event) => {
                const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.interview
                const Icon = config.icon
                const timeUntil = getTimeUntil(event.scheduled_date, event.scheduled_time)

                return (
                  <article key={event.id} className="rounded-card border border-line bg-surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-card p-3 ${config.badgeColor}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-fg">
                            {event.event_title || `${config.label} - ${event.applications?.reference_number || 'Pending reference'}`}
                          </h3>
                          <p className="mt-1 text-sm text-fg-muted">
                            {event.profiles?.full_name || 'Applicant'}{event.applications?.reference_number ? ` • ${event.applications.reference_number}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.badgeColor}`}>
                          {config.label}
                        </span>
                        <span
                          className={`text-xs font-medium ${
 timeUntil.isPast
 ? 'text-fg-muted'
 : timeUntil.isToday
 ? 'text-warning'
 : 'text-success'
 }`}
                        >
                          {timeUntil.text}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-fg-secondary sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-fg-muted" />
                        <span>
                          {event.eventDate?.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) || 'Time TBD'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-fg-muted" />
                        <span>{event.applications?.applied_rank || 'Rank pending'}</span>
                      </div>

                      {event.location_details ? (
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <MapPin className="h-4 w-4 text-fg-muted" />
                          {String(event.location_details).startsWith('http') ? (
                            <a
                              href={event.location_details}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-accent-text transition hover:text-accent-text hover:underline"
                            >
                              Open meeting link
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span>{event.location_details}</span>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {event.event_description ? (
                      <p className="mt-4 rounded-control bg-raised px-4 py-3 text-sm text-fg-secondary">
                        {event.event_description}
                      </p>
                    ) : null}
                  </article>
                )
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
