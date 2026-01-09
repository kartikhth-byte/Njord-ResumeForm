// src/components/dashboard/CalendarDashboard.jsx
// Dashboard to view all scheduled interviews and tests

import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'  // ADD THIS
import { useAuth } from '../auth/AuthContext'  // ADD THIS
import { usePermissions } from '../../hooks/usePermissions'  // ADD THIS
import { supabase } from '../../lib/supabase'
import DashboardHeader from './DashboardHeader'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  MapPin, 
  User, 
  FileText,
  AlertCircle,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const EVENT_TYPE_CONFIG = {
  interview: {
    icon: Video,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    badgeColor: 'bg-blue-100 text-blue-800',
    label: 'Interview'
  },
  test: {
    icon: FileText,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    badgeColor: 'bg-purple-100 text-purple-800',
    label: 'Test'
  }
}

export default function CalendarDashboard() {
  const { user } = useAuth()  // ADD THIS
  const { role, loading: permLoading } = usePermissions(user)  // ADD THIS
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    interviews: 0,
    tests: 0
  })
  const [selectedFilter, setSelectedFilter] = useState('upcoming') // upcoming, today, week, all
  const [selectedType, setSelectedType] = useState('all') // all, interview, test

    // PERMISSION CHECK: Block non-recruiters
  if (!permLoading && role !== 'recruiter' && role !== 'master_recruiter') {
    return <Navigate to="/recruiter" replace />
  }

  // Show loading while checking permissions
  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (!permLoading) {  // ADD THIS CHECK
      fetchScheduledEvents()
      }
  }, [permLoading])  // ADD permLoading DEPENDENCY)

  useEffect(() => {
    applyFilters()
  }, [events, selectedFilter, selectedType])

  const fetchScheduledEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all scheduled events
      const { data: eventsData, error: eventsError } = await supabase
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

      setEvents(eventsData || [])
      calculateSummary(eventsData || [])

    } catch (err) {
      console.error('Error fetching scheduled events:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const combineDateTime = (date, time) => {
    if (!date) return null
    // Combine date and time into a single Date object
    const dateStr = date
    const timeStr = time || '00:00:00'
    return new Date(`${dateStr}T${timeStr}`)
  }

  const calculateSummary = (eventsData) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekFromNow = new Date(today)
    weekFromNow.setDate(weekFromNow.getDate() + 7)

    const summary = {
      total: eventsData.length,
      today: 0,
      thisWeek: 0,
      interviews: 0,
      tests: 0
    }

    eventsData.forEach(event => {
      const eventDate = combineDateTime(event.scheduled_date, event.scheduled_time)
      if (!eventDate) return
      
      // Count by date
      if (eventDate >= today && eventDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
        summary.today++
      }
      if (eventDate >= today && eventDate < weekFromNow) {
        summary.thisWeek++
      }

      // Count by type
      if (event.event_type === 'interview') {
        summary.interviews++
      } else if (event.event_type === 'test') {
        summary.tests++
      }
    })

    setSummary(summary)
  }

  const applyFilters = () => {
    let filtered = [...events]
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Apply date filter
    switch (selectedFilter) {
      case 'today':
        filtered = filtered.filter(event => {
          const eventDate = combineDateTime(event.scheduled_date, event.scheduled_time)
          if (!eventDate) return false
          return eventDate >= today && eventDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
        })
        break
      case 'week':
        const weekFromNow = new Date(today)
        weekFromNow.setDate(weekFromNow.getDate() + 7)
        filtered = filtered.filter(event => {
          const eventDate = combineDateTime(event.scheduled_date, event.scheduled_time)
          if (!eventDate) return false
          return eventDate >= today && eventDate < weekFromNow
        })
        break
      case 'upcoming':
        filtered = filtered.filter(event => {
          const eventDate = combineDateTime(event.scheduled_date, event.scheduled_time)
          if (!eventDate) return false
          return eventDate >= now
        })
        break
      case 'past':
        filtered = filtered.filter(event => {
          const eventDate = combineDateTime(event.scheduled_date, event.scheduled_time)
          if (!eventDate) return false
          return eventDate < now
        })
        break
      // 'all' shows everything
    }

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(event => event.event_type === selectedType)
    }

    setFilteredEvents(filtered)
  }

  const formatDateTime = (dateString, timeString) => {
    const eventDate = combineDateTime(dateString, timeString)
    if (!eventDate) return { date: 'N/A', time: 'N/A', dayOfWeek: '' }
    
    return {
      date: eventDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: eventDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      dayOfWeek: eventDate.toLocaleDateString('en-US', { weekday: 'short' })
    }
  }

  const getTimeUntil = (dateString, timeString) => {
    const now = new Date()
    const eventDate = combineDateTime(dateString, timeString)
    if (!eventDate) return { text: 'Date TBD', isPast: false }
    
    const diffMs = eventDate - now
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (diffMs < 0) {
      return { text: 'Past event', isPast: true }
    } else if (diffDays === 0) {
      if (diffHours === 0) {
        return { text: 'Starting soon', isPast: false, isToday: true }
      }
      return { text: `In ${diffHours}h`, isPast: false, isToday: true }
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', isPast: false }
    } else if (diffDays < 7) {
      return { text: `In ${diffDays} days`, isPast: false }
    } else {
      return { text: `In ${diffDays} days`, isPast: false }
    }
  }

  const filterButtons = [
    { id: 'upcoming', label: 'Upcoming', count: events.filter(e => {
      const eventDate = combineDateTime(e.scheduled_date, e.scheduled_time)
      return eventDate && eventDate >= new Date()
    }).length },
    { id: 'today', label: 'Today', count: summary.today },
    { id: 'week', label: 'This Week', count: summary.thisWeek },
    { id: 'past', label: 'Past', count: events.filter(e => {
      const eventDate = combineDateTime(e.scheduled_date, e.scheduled_time)
      return eventDate && eventDate < new Date()
    }).length },
    { id: 'all', label: 'All', count: summary.total }
  ]

  const typeButtons = [
    { id: 'all', label: 'All Events', count: summary.total },
    { id: 'interview', label: 'Interviews', count: summary.interviews },
    { id: 'test', label: 'Tests', count: summary.tests }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading scheduled events...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-900 font-semibold mb-1">Error Loading Events</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={fetchScheduledEvents}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

 return (
  <div className="space-y-6">
    {/* Header with Back Navigation */}
    <DashboardHeader
      title="Calendar Dashboard"
      description="View and manage scheduled interviews and tests"
      onRefresh={fetchScheduledEvents}
    />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <CalendarIcon className="w-6 h-6 text-gray-600" />
            <span className="text-3xl font-bold text-gray-900">{summary.total}</span>
          </div>
          <p className="text-sm font-semibold text-gray-700">Total Events</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-6 h-6 text-blue-600" />
            <span className="text-3xl font-bold text-blue-900">{summary.today}</span>
          </div>
          <p className="text-sm font-semibold text-blue-800">Today</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <CalendarIcon className="w-6 h-6 text-green-600" />
            <span className="text-3xl font-bold text-green-900">{summary.thisWeek}</span>
          </div>
          <p className="text-sm font-semibold text-green-800">This Week</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <Video className="w-6 h-6 text-blue-600" />
            <span className="text-3xl font-bold text-blue-900">{summary.interviews}</span>
          </div>
          <p className="text-sm font-semibold text-blue-800">Interviews</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-6 h-6 text-purple-600" />
            <span className="text-3xl font-bold text-purple-900">{summary.tests}</span>
          </div>
          <p className="text-sm font-semibold text-purple-800">Tests</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {/* Date Filter */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Filter by Date
          </label>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSelectedFilter(btn.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === btn.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            ))}
          </div>
        </div>

        {/* Type Filter */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Filter by Type
          </label>
          <div className="flex flex-wrap gap-2">
            {typeButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSelectedType(btn.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === btn.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Events Found
          </h3>
          <p className="text-gray-600">
            {selectedFilter !== 'all' || selectedType !== 'all'
              ? 'Try adjusting your filters'
              : 'No interviews or tests have been scheduled yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'}
            </h2>
          </div>

          {filteredEvents.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.interview
            const Icon = config.icon
            const dateTime = formatDateTime(event.scheduled_date, event.scheduled_time)
            const timeUntil = getTimeUntil(event.scheduled_date, event.scheduled_time)
            
            return (
              <div
                key={event.id}
                className={`${config.bgColor} ${config.borderColor} border rounded-lg p-5 hover:shadow-md transition-shadow ${
                  timeUntil.isPast ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Event Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 ${config.badgeColor} rounded-lg`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {event.event_title || `${config.label} - ${event.applications?.reference_number}`}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {event.profiles?.full_name || 'Applicant'} • {event.applications?.reference_number}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {dateTime.dayOfWeek}, {dateTime.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {dateTime.time}
                        </span>
                      </div>

                      {event.location_details && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700 truncate">
                            {event.location_details}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {event.applications?.applied_rank || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {event.event_description && (
                      <p className="mt-3 text-sm text-gray-600">
                        {event.event_description}
                      </p>
                    )}

                    {event.platform && event.location_type === 'online' && (
                      <div className="mt-3 text-sm text-blue-600 font-medium">
                        Platform: {event.platform}
                      </div>
                    )}
                  </div>

                  {/* Right: Status Badge */}
                  <div className="flex flex-col items-end gap-2">
                    <span className={`${config.badgeColor} px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap`}>
                      {config.label}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        timeUntil.isPast
                          ? 'text-gray-500'
                          : timeUntil.isToday
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}
                    >
                      {timeUntil.text}
                    </span>
                    {event.status && (
                      <span className="text-xs text-gray-600 capitalize">
                        Status: {event.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer Info */}
      {events.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Automatic Reminders</p>
              <p>
                Applicants receive email reminders 24 hours before their scheduled event. 
                The system runs daily at 10 AM UTC to send reminder notifications.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}