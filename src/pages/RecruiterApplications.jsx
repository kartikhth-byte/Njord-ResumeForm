/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import StatusBadge from '../components/StatusBadge'
import { formatDisplayValue } from '../utils/formatUtils'
import SequentialStatusControl from '../components/SequentialStatusControl'
import ApplicationFilters from '../components/ApplicationFilters'
import Pagination from '../components/Pagination'
import ConfidenceBadge from '../components/ConfidenceBadge'
import PageHeader from '../components/ui/PageHeader'
import { buildApplicationCompliance } from '../utils/applicationCompliance'
import { applicationStatusLabel, CLOSED_APPLICATION_STATUSES } from '../constants/applicationStatus'

import { Search, Loader2, SlidersHorizontal } from 'lucide-react'

function normalizeCertificateGrade(value) {
  return (value || '').toString().trim().toLowerCase()
}

function getApplicationFields(appData = {}) {
  const section1 = appData.section1 || {}
  const section2 = appData.section2 || {}
  const section5 = appData.section5 || {}
  const section8 = appData.section8 || {}
  const section15 = appData.section15 || {}
  const section16 = appData.section16 || {}

  return {
    section1,
    section2,
    section5,
    section8,
    section15,
    section16,
    visas: Array.isArray(section5.visas) ? section5.visas : [],
    certificates: Array.isArray(section8.certificates) ? section8.certificates : [],
    endorsements: Array.isArray(section15.endorsements) ? section15.endorsements : [],
    seaService: Array.isArray(section16.seaService) ? section16.seaService : []
  }
}

const COMPLIANCE_STYLES = {
  red: 'bg-danger-soft text-danger border-danger-line',
  amber: 'bg-warning-soft text-warning border-warning-line',
  green: 'bg-success-soft text-success border-success-line',
}

function complianceLabel(status) {
  return status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : 'Unknown'
}

function ComplianceBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${COMPLIANCE_STYLES[status] || 'bg-raised text-fg-secondary border-line'}`}>
      {complianceLabel(status)}
    </span>
  )
}

// Pipeline stages for the chips above the list. "Active" is everything
// not closed; "Closed" loads hired, rejected and withdrawn.
const STAGES = [
  { id: 'all', label: 'Active', statuses: null },
  { id: 'review', label: 'Review', statuses: ['submitted', 'new', 'under_review'] },
  { id: 'test', label: 'Test', statuses: ['test_scheduled', 'test_completed', 'test_passed', 'test_failed'] },
  { id: 'interview', label: 'Interview', statuses: ['interview_scheduled', 'interview_completed', 'interview_passed', 'second_interview_scheduled', 'second_interview_completed'] },
  { id: 'offer', label: 'Offer', statuses: ['offered', 'offer_accepted', 'documents_pending'] },
  { id: 'closed', label: 'Closed', statuses: CLOSED_APPLICATION_STATUSES },
]

function stageForFilter(filter) {
  return STAGES.find((stage) => stage.id === filter) ||
    STAGES.find((stage) => stage.statuses?.includes(filter)) ||
    STAGES[0]
}

function matchesStatusFilter(status, filter) {
  if (!filter || filter === 'all') return !CLOSED_APPLICATION_STATUSES.includes(status)
  const stage = STAGES.find((entry) => entry.id === filter)
  if (stage) return stage.statuses.includes(status)
  return status === filter
}

const ACTIVE_APPLICATION_STATUSES = [
  'submitted',
  'new',
  'under_review',
  'test_scheduled',
  'test_completed',
  'test_passed',
  'test_failed',
  'interview_scheduled',
  'interview_completed',
  'interview_passed',
  'second_interview_scheduled',
  'second_interview_completed',
  'offered',
  'offer_accepted',
  'documents_pending'
]

function applyRecruiterVisibilityFilter(query) {
  return query.not('submitted_at', 'is', null)
}

export default function RecruiterApplications() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const { canViewApplications, canManageApplications, loading: permLoading, role } = usePermissions()
  const canEditApplications = canManageApplications()

  const [applications, setApplications] = useState([])
  const [autoOpenInterviewForApp, setAutoOpenInterviewForApp] = useState(null)

  // Restore the interview modal after Teams OAuth returns to the applications workspace.
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const teamsConnected = urlParams.get('teams_connected')
  const applicationId = localStorage.getItem('reopen_interview_modal')
  
  if (teamsConnected === 'true' && applicationId) {
    // Wait until applications are actually loaded
    if (applications.length === 0) {
      return
    }
    
    const app = applications.find(a => a.id === applicationId)

    if (app) {
      // Clean up
      localStorage.removeItem('reopen_interview_modal')
      window.history.replaceState({}, '', '/recruiter/applications')
      
      // Tell SequentialStatusControl to auto-open
      setAutoOpenInterviewForApp(app.id)
    } else {
      localStorage.removeItem('reopen_interview_modal')
      window.history.replaceState({}, '', '/recruiter/applications')
    }
  }
}, [applications])

  const [statusCounts, setStatusCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [complianceFilter, setComplianceFilter] = useState('all')
  const [filters, setFilters] = useState({})
  const [showFilters, setShowFilters] = useState(false)

  // ?status= holds a stage id ("review", "closed", ...) or a single status.
  const statusFilter = searchParams.get('status') || 'all'
  const scope = stageForFilter(statusFilter).id === 'closed' ? 'closed' : 'active'

  const updateStatusFilter = (next) => {
    const params = new URLSearchParams(searchParams)
    params.delete('tab')
    if (!next || next === 'all') params.delete('status')
    else params.set('status', next)
    setSearchParams(params, { replace: true })
  }

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [notesByProspect, setNotesByProspect] = useState({})

  useEffect(() => {
    const prospectIds = [...new Set(applications.map((app) => app.prospect_id).filter(Boolean))]
    if (prospectIds.length === 0) {
      setNotesByProspect({})
      return undefined
    }
    let cancelled = false
    supabase
      .from('prospect_notes')
      .select('prospect_id, body, created_at')
      .in('prospect_id', prospectIds)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error: notesError }) => {
        if (cancelled || notesError) return
        const map = {}
        for (const note of data || []) {
          if (!map[note.prospect_id]) map[note.prospect_id] = note.body
        }
        setNotesByProspect(map)
      })
    return () => {
      cancelled = true
    }
  }, [applications])
  
  useEffect(() => {
    if (!permLoading && canViewApplications()) {
      loadApplications(filters)
      loadStatusCounts()
    }
  }, [permLoading, scope])

  useEffect(() => { setCurrentPage(1) }, [statusFilter, searchTerm, filters, complianceFilter])

  const calculateExperience = (seaService) => {
    if (!seaService || seaService.length === 0) return 0
    let totalDays = 0
    seaService.forEach(service => {
      if (service.signOnDate && service.signOffDate) {
        const signOn = new Date(service.signOnDate)
        const signOff = new Date(service.signOffDate)
        const days = Math.floor((signOff - signOn) / (1000 * 60 * 60 * 24))
        totalDays += days
      }
    })
    return Math.floor(totalDays / 365)
  }


  const matchesExperienceFilter = (years, filterValue) => {
    switch (filterValue) {
      case '0-2': return years >= 0 && years <= 2
      case '3-5': return years >= 3 && years <= 5
      case '6-10': return years >= 6 && years <= 10
      case '10+': return years >= 10
      default: return true
    }
  }

  const matchesAgeRange = (age, filterValue) => {
    const ageNum = parseInt(age)
    if (isNaN(ageNum)) return false
    switch (filterValue) {
      case '20-30': return ageNum >= 20 && ageNum <= 30
      case '31-40': return ageNum >= 31 && ageNum <= 40
      case '41-50': return ageNum >= 41 && ageNum <= 50
      case '50+': return ageNum >= 50
      default: return true
    }
  }

  const matchesAvailability = (availableFrom, filterValue) => {
    if (!availableFrom) return false
    const availDate = new Date(availableFrom)
    const today = new Date()
    const daysUntilAvailable = Math.floor((availDate - today) / (1000 * 60 * 60 * 24))
    switch (filterValue) {
      case 'now': return daysUntilAvailable <= 0
      case '30': return daysUntilAvailable <= 30
      case '60': return daysUntilAvailable <= 60
      case '90': return daysUntilAvailable <= 90
      default: return true
    }
  }

  const loadApplications = async (appliedFilters = {}, { background = false } = {}) => {
    try {
      if (background) {
        setBackgroundRefreshing(true)
      } else {
        setLoading(true)
      }

      let query = supabase
        .from('applications')
        .select(`
          id,
          user_id,
          applied_rank,
          status,
          created_at,
          updated_at,
          reference_number,
          public_token,
          submitted_at,
          test_attempt_number,
          test_max_attempts,
          handling_recruiter_id,
          contract_end_date,
          prospect_id,
          application_data (
            data
          )
        `)

      query = applyRecruiterVisibilityFilter(query)

      query = query.in('status', scope === 'closed' ? CLOSED_APPLICATION_STATUSES : ACTIVE_APPLICATION_STATUSES)

      if (appliedFilters.position) {
        query = query.eq('applied_rank', appliedFilters.position)
      }

      if (appliedFilters.dateRange?.from) {
        query = query.gte('created_at', appliedFilters.dateRange.from)
      }

      if (appliedFilters.dateRange?.to) {
        query = query.lte('created_at', appliedFilters.dateRange.to + 'T23:59:59')
      }

      const { data: appsData, error: appsError } = await query.order('created_at', { ascending: false })

      if (appsError) throw appsError

      if (!appsData || appsData.length === 0) {
        setApplications([])
        return
      }

      const applicantIds = [...new Set(appsData.map(app => app.user_id))]
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', applicantIds)

      if (profilesError) throw profilesError

      let formattedData = appsData.map(app => {
        const profile = profilesData.find(p => p.id === app.user_id)
        const section1 = app.application_data?.data?.section1 || {}
        const section2 = app.application_data?.data?.section2 || {}
        const section8 = app.application_data?.data?.section8 || {}
        const section16 = app.application_data?.data?.section16 || {}
        
        const fullName = [
          section2.firstName,
          section2.middleName,
          section2.surname
        ].filter(Boolean).join(' ').trim() || profile?.full_name || 'Unknown'
        
        const age = section2.dateOfBirth 
          ? Math.floor((new Date() - new Date(section2.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
          : null

        return {
          ...app,
          full_name: fullName,
          email: section2.email || profile?.email || '',
          phone: section2.phoneNumber || section2.phone || '',
          desired_rank: section1.appliedForRank || app.applied_rank || '',
          vessel_type: section1.vesselType || '',
          nationality: section2.nationality || '',
          age: age,
          experience_years: calculateExperience(section16.seaService),
          available_from: section1.availableFrom || '',
          last_vessel: section16.seaService?.[0]?.vesselName || '',
          last_rank: section16.seaService?.[0]?.rankHeld || '',
          coc_number: section8.certificates?.[0]?.certificateNumber || '',
          coc_issuing_country: section8.certificates?.[0]?.issuingAuthority || '',
          compliance: buildApplicationCompliance(app.application_data?.data || {}),
        }
      }).map((app) => ({
        ...app,
        compliance_status: app.compliance?.overallStatus || '',
        compliance_summary: app.compliance?.summary || null,
      }))

      // Apply client-side filters
      if (appliedFilters.nationality) {
        formattedData = formattedData.filter(app => app.nationality === appliedFilters.nationality)
      }
      if (appliedFilters.vesselType) {
        formattedData = formattedData.filter(app => app.vessel_type === appliedFilters.vesselType)
      }
      if (appliedFilters.experienceRange) {
        formattedData = formattedData.filter(app => matchesExperienceFilter(app.experience_years, appliedFilters.experienceRange))
      }
      if (appliedFilters.ageRange) {
        formattedData = formattedData.filter(app => app.age !== null && matchesAgeRange(app.age, appliedFilters.ageRange))
      }
      if (appliedFilters.availability) {
        formattedData = formattedData.filter(app => app.available_from && matchesAvailability(app.available_from, appliedFilters.availability))
      }

            // Certificate Grade filter
      if (appliedFilters.certificateGrade) {
        formattedData = formattedData.filter(app => {
          const fields = getApplicationFields(app.application_data?.data)
          const selectedGrade = normalizeCertificateGrade(appliedFilters.certificateGrade)
          return fields.certificates.some(cert =>
            normalizeCertificateGrade(cert.grade) === selectedGrade
          )
        })
      }

      // Visa Type filter
      if (appliedFilters.visaType) {
        formattedData = formattedData.filter(app => {
          const fields = getApplicationFields(app.application_data?.data)
          return fields.visas.some(visa =>
            visa.type === appliedFilters.visaType
          )
        })
      }

      // Flag State filter
      if (appliedFilters.flagState) {
        formattedData = formattedData.filter(app => {
          const fields = getApplicationFields(app.application_data?.data)
          return fields.endorsements.some(endorsement =>
            endorsement.flagState === appliedFilters.flagState
          )
        })
      }

      setApplications(formattedData)
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      if (background) {
        setBackgroundRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }

  const loadStatusCounts = async () => {
    try {
      const { data, error } = await applyRecruiterVisibilityFilter(
        supabase.from('applications').select('status')
      )
      if (error) throw error
      const counts = {}
      for (const row of data || []) {
        counts[row.status] = (counts[row.status] || 0) + 1
      }
      setStatusCounts(counts)
    } catch (error) {
      console.error('Error loading status counts:', error)
    }
  }

const updateContractEndDate = async (applicationId, value) => {
  try {
    const { error: updateError } = await supabase
      .from('applications')
      .update({ contract_end_date: value || null })
      .eq('id', applicationId)
    if (updateError) throw updateError
    const patch = (rows) => rows.map((row) => (row.id === applicationId ? { ...row, contract_end_date: value || null } : row))
    setApplications(patch)
  } catch (contractError) {
    console.error('Failed to update contract end date:', contractError)
    alert(`Could not save the contract end date${contractError?.message ? `: ${contractError.message}` : ''}`)
  }
}

const handleStatusChange = async (applicationId, newStatus) => {
  const appToUpdate = applications.find(a => a.id === applicationId)
  if (!appToUpdate) return

  try {
    const { error } = await supabase
      .from('applications')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', applicationId)

    if (error) throw error

    // Update local state
    setApplications(prev =>
      prev.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    )

    // Refresh the counts and the list so the row moves to its new stage.
    await Promise.all([
      loadStatusCounts(),
      loadApplications(filters, { background: true })
    ])
  } catch (error) {
    console.error('Error updating status:', error)
    alert('Failed to update status')
  }
}

  const handleApplyFilters = (filtersToApply = null) => {
    loadApplications(filtersToApply || filters)
  }

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-text" />
      </div>
    )
  }

  if (!canViewApplications()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-fg-secondary">You do not have permission to view applications.</p>
      </div>
    )
  }

  const term = searchTerm.trim().toLowerCase()
  const listed = applications.filter((app) => {
    if (!matchesStatusFilter(app.status, statusFilter)) return false
    if (complianceFilter !== 'all' && app.compliance_status !== complianceFilter) return false
    if (!term) return true
    return [app.full_name, app.email, app.reference_number, app.desired_rank, app.vessel_type, app.nationality]
      .some((value) => value?.toLowerCase().includes(term))
  })

  const complianceCounts = applications
    .filter((app) => matchesStatusFilter(app.status, statusFilter))
    .reduce((counts, app) => {
      if (Object.prototype.hasOwnProperty.call(counts, app.compliance_status)) counts[app.compliance_status] += 1
      return counts
    }, { red: 0, amber: 0, green: 0 })

  const displayed = listed
  const pageRows = displayed.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(displayed.length / itemsPerPage)

  const stageCount = (stage) => {
    if (stage.statuses) return stage.statuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0)
    return Object.entries(statusCounts)
      .filter(([status]) => !CLOSED_APPLICATION_STATUSES.includes(status))
      .reduce((sum, [, count]) => sum + count, 0)
  }
  const activeStage = stageForFilter(statusFilter)
  const subStatuses = activeStage.statuses
    ? activeStage.statuses.filter((status) => (statusCounts[status] || 0) > 0)
    : []
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const ApplicationTable = ({ apps, showRelevance = false, analyzingWithLLM = false }) => {
  return (
    <div className="tracker-table-wrap overflow-y-visible">
      <table className="tracker-table">
        <thead>
          <tr>
            <th className="tracker-cell--sticky-1">Reference</th>
            <th className="tracker-cell--sticky-2">Name</th>
            <th>Status</th>
            <th>Compliance</th>
            <th>Present rank</th>
            <th>Applied rank</th>
            <th>Vessel type</th>
            <th>Submitted</th>
            {showRelevance ? (
              <>
                <th>Relevance</th>
                <th>AI match</th>
              </>
            ) : null}
            <th>Actions</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {apps.length === 0 ? (
            <tr>
              <td colSpan={showRelevance ? 12 : 10} className="px-6 py-12 text-center text-fg-muted">
                No applications found
              </td>
            </tr>
          ) : (
            apps.map((app) => (
              <tr key={app.id}>
                <td className="tracker-cell--sticky-1 tracker-cell--nowrap">
                  <span className="font-mono text-xs font-medium text-accent-text">{app.reference_number}</span>
                </td>
                <td className="tracker-cell--sticky-2 tracker-cell--primary tracker-cell--nowrap">
                  <button
                    type="button"
                    onClick={() => navigate(`/application/view/${app.public_token}`)}
                    className="block max-w-[13rem] truncate text-left hover:text-accent-text"
                    title={app.full_name}
                  >
                    {app.full_name}
                  </button>
                </td>
                <td className="tracker-cell--nowrap"><StatusBadge status={app.status} /></td>
                <td className="tracker-cell--nowrap"><ComplianceBadge status={app.compliance_status} /></td>
                <td className="tracker-cell--nowrap">{formatDisplayValue(app.last_rank) || '—'}</td>
                <td className="tracker-cell--nowrap">{formatDisplayValue(app.desired_rank) || '—'}</td>
                <td className="tracker-cell--nowrap">{formatDisplayValue(app.vessel_type) || '—'}</td>
                <td className="tracker-cell--nowrap tracker-cell--muted">
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}
                </td>
                {showRelevance ? (
                  <>
                    <td className="tracker-cell--nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-line">
                          <div className="h-2 rounded-full bg-accent-fill" style={{ width: `${app.similarity * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-fg-secondary">{(app.similarity * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="tracker-cell--nowrap">
                      {analyzingWithLLM && !app.llmAnalysis ? (
                        <div className="flex items-center gap-2 text-progress">
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-progress"></div>
                          <span className="text-xs font-medium">Analyzing...</span>
                        </div>
                      ) : app.llmAnalysis ? (
                        <ConfidenceBadge llmAnalysis={app.llmAnalysis} compact={true} />
                      ) : (
                        <span className="text-xs text-fg-muted">—</span>
                      )}
                    </td>
                  </>
                ) : null}
                <td className="tracker-cell--nowrap">
                  <div className="flex items-center gap-1.5">
                    {canEditApplications ? (
                      <SequentialStatusControl
                        applicationId={app.id}
                        currentStatus={app.status}
                        onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
                        application={app}
                        autoOpenInterview={autoOpenInterviewForApp === app.id}
                        onAutoOpenComplete={() => setAutoOpenInterviewForApp(null)}
                      />
                    ) : null}
                    {canEditApplications && app.status === 'hired' ? (
                      <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-fg-muted" title="Contract end date — drives the crew-coming-available alert on the KPI dashboard">
                        Contract ends
                        <input
                          type="date"
                          value={app.contract_end_date || ''}
                          onChange={(event) => updateContractEndDate(app.id, event.target.value)}
                          className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-accent"
                        />
                      </label>
                    ) : null}
                  </div>
                </td>
                <td className="max-w-[14rem] tracker-cell--muted">
                  <span className="line-clamp-2">{(app.prospect_id && notesByProspect[app.prospect_id]) || '—'}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

  return (
    <div className="recruiter-shell">
      <RecruiterTopbar
        user={user}
        profile={profile}
        role={role}
        signOut={signOut}
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Applications"
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              {backgroundRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-fg-muted" aria-label="Updating" /> : null}
              <button
                type="button"
                onClick={() => setShowFilters((open) => !open)}
                aria-pressed={showFilters}
                className={`workspace-action-button ${showFilters ? 'workspace-action-button--primary' : 'workspace-action-button--secondary'}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          )}
        />

        {showFilters ? (
          <ApplicationFilters
            onFilterChange={setFilters}
            onApplyFilters={handleApplyFilters}
            activeFilters={filters}
          />
        ) : null}

        <div className="recruiter-panel overflow-hidden">
            <div className="space-y-3 border-b border-line px-5 py-4 md:px-6">
              <div role="group" aria-label="Pipeline stage" className="flex flex-wrap gap-2">
                {STAGES.map((stage) => {
                  const active = activeStage.id === stage.id
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => updateStatusFilter(stage.id)}
                      aria-pressed={active}
                      className={`flex min-w-[6.5rem] flex-col items-start gap-0.5 rounded-card border px-3.5 py-2.5 text-left transition ${
                        active ? 'border-accent-fill bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
                      }`}
                    >
                      <span className="text-xl font-semibold leading-tight text-fg">{stageCount(stage)}</span>
                      <span className="text-xs text-fg-secondary">{stage.label}</span>
                    </button>
                  )
                })}
              </div>

              {subStatuses.length > 1 ? (
                <div role="group" aria-label={`${activeStage.label} statuses`} className="flex flex-wrap gap-2">
                  {subStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateStatusFilter(statusFilter === status ? activeStage.id : status)}
                      aria-pressed={statusFilter === status}
                      className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${
                        statusFilter === status
                          ? 'border-accent/40 bg-accent-soft text-accent-text'
                          : 'border-line bg-surface text-fg-secondary hover:bg-raised'
                      }`}
                    >
                      {applicationStatusLabel(status)}
                      <span className="text-fg">{statusCounts[status] || 0}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-fg-secondary">{listed.length} shown</span>
                  {['red', 'amber', 'green'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setComplianceFilter((current) => (current === status ? 'all' : status))}
                      aria-pressed={complianceFilter === status}
                      title={`Show only ${status}`}
                      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${COMPLIANCE_STYLES[status]} ${
                        complianceFilter === status ? 'ring-2 ring-accent/40' : complianceFilter === 'all' ? '' : 'opacity-50'
                      }`}
                    >
                      {complianceLabel(status)}
                      <span>{complianceCounts[status]}</span>
                    </button>
                  ))}
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Name, email or reference"
                    className="w-full rounded-card border border-line-input bg-surface py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>


          <div className="space-y-6 p-5 md:p-6">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
              </div>
            ) : (
              <>
                <ApplicationTable apps={pageRows} />
                {displayed.length > itemsPerPage ? (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={displayed.length}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
