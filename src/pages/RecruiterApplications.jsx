/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import StatusBadge from '../components/StatusBadge'
import { formatDisplayValue } from '../utils/formatUtils'
import SequentialStatusControl from '../components/SequentialStatusControl'
import ApplicationFilters from '../components/ApplicationFilters'
import Pagination from '../components/Pagination'
import EmbeddingGenerator from '../components/EmbeddingGenerator'
import AISearch from '../components/AISearch'
import OfferModal from '../components/recruiter/OfferModal'
import ConfidenceBadge from '../components/ConfidenceBadge'
import PageHeader from '../components/ui/PageHeader'
import SegmentedControl from '../components/ui/SegmentedControl'
import WorkspaceToolbar from '../components/ui/WorkspaceToolbar'
import EmptyState from '../components/ui/EmptyState'
import { getEmbeddingReadiness } from '../services/embeddingService'
import { buildApplicationCompliance } from '../utils/applicationCompliance'

import { 
  Users, 
  Search, 
  Eye, 
  Loader2, 
  PanelLeft,
  ChevronDown, 
  ChevronRight,
  FileText,
  Clock,
  CheckCircle,
  Sparkles,
  SlidersHorizontal,
  ShieldCheck
} from 'lucide-react'

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

function ComplianceBadge({ status, summary, size = 'default' }) {
  const styles = {
    red: 'bg-danger-soft text-danger border-danger-line',
    amber: 'bg-warning-soft text-warning border-warning-line',
    green: 'bg-success-soft text-success border-success-line',
  }
  const sizeClass = size === 'compact'
    ? 'rounded-lg px-2.5 py-1 text-[11px] font-semibold'
    : 'rounded-control px-3 py-1.5 text-xs font-semibold'

  const label = status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : 'Unknown'

  return (
    <div className={`inline-flex items-center border ${sizeClass} ${styles[status] || 'bg-raised text-fg-secondary border-line'}`}>
      <span>{label}</span>
      {typeof summary === 'number' ? <span className="ml-2">{summary}</span> : null}
    </div>
  )
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

function formatEmbeddingStatusMessage(readiness) {
  if (!readiness) return ''

  const issues = []
  if (readiness.missing?.length) {
    issues.push(`${readiness.missing.length} active application${readiness.missing.length === 1 ? '' : 's'} are not indexed`)
  }
  if (readiness.stale?.length) {
    issues.push(`${readiness.stale.length} indexed application${readiness.stale.length === 1 ? ' is' : 's are'} out of date`)
  }

  if (issues.length === 0) {
    return 'Embeddings are ready for AI Search.'
  }

  return `AI Search is locked until embeddings are ready: ${issues.join(' and ')}. Generate embeddings now, then run the search.`
}

const VALID_RECRUITER_APPLICATION_TABS = new Set(['all', 'search'])

function normalizeRecruiterApplicationsTab(tabValue) {
  return VALID_RECRUITER_APPLICATION_TABS.has(tabValue) ? tabValue : 'all'
}

export default function RecruiterApplications() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const { canViewApplications, loading: permLoading, role } = usePermissions()
  const aiSearchStorageKey = user?.id ? `aiSearchResults:${user.id}` : null
  
  const [applications, setApplications] = useState([])
  const [autoOpenInterviewForApp, setAutoOpenInterviewForApp] = useState(null)
  const [analyzingWithLLM, setAnalyzingWithLLM] = useState(false)


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

  const [filteredApplications, setFilteredApplications] = useState([])
  const [allStatusCounts, setAllStatusCounts] = useState({}) // New: stores counts of ALL applications
  const [loading, setLoading] = useState(true)
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Initialize statusFilter from URL or default to 'all'
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [filters, setFilters] = useState({})
  const [complianceFilter, setComplianceFilter] = useState('all')
  const [includeRejected, setIncludeRejected] = useState(false) // Include rejected candidates
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false) // Include withdrawn candidates  
  const [includeHired, setIncludeHired] = useState(false) // Include hired candidates
  const [includeActive, setIncludeActive] = useState(true) // Include active candidates (default: true)
  
const [isOfferModalOpen, setIsOfferModalOpen] = useState(false)
const [offerApplication, setOfferApplication] = useState(null)
  const [embeddingReadiness, setEmbeddingReadiness] = useState(null)
  const [embeddingReadinessLoading, setEmbeddingReadinessLoading] = useState(false)

  // Tab management - initialize from URL or default to 'all'
  const [activeTab, setActiveTab] = useState(normalizeRecruiterApplicationsTab(searchParams.get('tab') || 'all'))
  
  // Helper function to update tab and URL
  const updateActiveTab = (newTab) => {
    setActiveTab(newTab)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', newTab)
    if (statusFilter && statusFilter !== 'all') {
      newParams.set('status', statusFilter)
    }
    setSearchParams(newParams, { replace: true })
  }
  
  // Helper function to update status filter and URL
  const updateStatusFilter = (newStatus) => {
    setStatusFilter(newStatus)
    const newParams = new URLSearchParams(searchParams)
    if (activeTab && activeTab !== 'all') {
      newParams.set('tab', activeTab)
    }
    newParams.set('status', newStatus)
    setSearchParams(newParams, { replace: true })
  }
  
  // Sync state with URL when navigating back
  useEffect(() => {
    const rawTabFromUrl = searchParams.get('tab') || 'all'
    const tabFromUrl = normalizeRecruiterApplicationsTab(rawTabFromUrl)
    const statusFromUrl = searchParams.get('status') || 'all'

    if (rawTabFromUrl !== tabFromUrl) {
      const correctedParams = new URLSearchParams(searchParams)
      correctedParams.set('tab', tabFromUrl)
      setSearchParams(correctedParams, { replace: true })
    }
    
    // Only update if different to avoid infinite loops
    setActiveTab(prev => {
      if (prev !== tabFromUrl) return tabFromUrl
      return prev
    })
    setStatusFilter(prev => {
      if (prev !== statusFromUrl) return statusFromUrl
      return prev
    })
  }, [searchParams])
  

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
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
  
  // AI Search
  const [aiSearchActive, setAiSearchActive] = useState(false)
  const [aiSearchResults, setAiSearchResults] = useState([])
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  
  // Advanced Search mode toggle
  const [searchMode, setSearchMode] = useState('ai')
  
  const [showDetailedStatusNav, setShowDetailedStatusNav] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(['initial', 'test', 'interview', 'final'])

  // Status groups for sidebar
  const statusGroups = [
    {
      id: 'initial',
      label: 'Initial Stage',
      icon: FileText,
      statuses: [
        { value: 'all', label: 'All Applications', count: 0 },
        { value: 'submitted', label: 'Submitted', count: 0 },
        { value: 'under_review', label: 'Under Review', count: 0 },
      ]
    },
    {
      id: 'test',
      label: 'Test',
      icon: Clock,
      statuses: [
        { value: 'test_scheduled', label: 'Test Scheduled', count: 0 },
        { value: 'test_completed', label: 'Test Completed', count: 0 },
      ]
    },
    {
      id: 'interview',
      label: 'Interview',
      icon: Users,
      statuses: [
        { value: 'interview_scheduled', label: 'Interview Scheduled', count: 0 },
        { value: 'interview_passed', label: 'Interview Passed', count: 0 },
      ]
    },
    {
      id: 'final',
      label: 'Final Stage',
      icon: CheckCircle,
      statuses: [
        { value: 'offered', label: 'Offered', count: 0 },
        { value: 'hired', label: 'Hired', count: 0 },
        { value: 'rejected', label: 'Rejected', count: 0 },
        { value: 'withdrawn', label: 'Withdrawn', count: 0 },
      ]
    }
  ];

  useEffect(() => {
    if (!permLoading && canViewApplications()) {
      loadApplications({})
      loadAllStatusCounts() // Load counts separately
      refreshEmbeddingReadiness()
    }
  }, [permLoading, includeRejected, includeWithdrawn, includeHired, includeActive]) // Reload when any status filter changes

useEffect(() => {
  if ((activeTab === 'all' || (activeTab === 'search' && searchMode === 'filters')) && !aiSearchActive) {
    filterApplications()
  }
}, [activeTab, applications, statusFilter, searchTerm, complianceFilter, includeRejected, aiSearchActive, searchMode])
  
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchTerm, filters, complianceFilter])

  const complianceCounts = filteredApplications.reduce((counts, app) => {
    const status = app.compliance_status
    if (status && Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1
    }
    return counts
  }, { red: 0, amber: 0, green: 0 })

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


// Restore AI search results from localStorage on mount
useEffect(() => {
  if (!aiSearchStorageKey) return
  
  const savedSearch = localStorage.getItem(aiSearchStorageKey)
  if (!savedSearch) {
    return
  }

  try {
    const { results, query, timestamp } = JSON.parse(savedSearch)
    
    // Only restore if less than 30 minutes old
    const THIRTY_MINUTES = 30 * 60 * 1000
    const age = Date.now() - timestamp
    
    if (age < THIRTY_MINUTES) {
      setAiSearchResults(results)
      setAiSearchQuery(query)
      setAiSearchActive(true)
      
      // Switch to search tab if we have results
      if (results.length > 0 && activeTab !== 'search') {
        updateActiveTab('search')
      }
    } else {
      localStorage.removeItem(aiSearchStorageKey)
    }
  } catch (error) {
    console.error('❌ Error restoring search results:', error)
    localStorage.removeItem(aiSearchStorageKey)
  }
}, [aiSearchStorageKey]) // Restore per signed-in recruiter only

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

      // Comprehensive status filtering based on checkboxes
      const statusesToInclude = []
      
      if (includeActive) {
        // Active statuses = not terminal (not hired, rejected, withdrawn)
        statusesToInclude.push(...ACTIVE_APPLICATION_STATUSES)
      }
      
      if (includeHired) {
        statusesToInclude.push('hired')
      }
      
      if (includeRejected) {
        statusesToInclude.push('rejected')
      }
      
      if (includeWithdrawn) {
        statusesToInclude.push('withdrawn')
      }
      
      // Apply status filter - if no statuses selected, show nothing
      if (statusesToInclude.length > 0) {
        query = query.in('status', statusesToInclude)
      } else {
        // No statuses selected - return empty result
        query = query.eq('status', 'non_existent_status')
      }

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
        const section5 = app.application_data?.data?.section5 || {}
        const section8 = app.application_data?.data?.section8 || {}
        const section15 = app.application_data?.data?.section15 || {}
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
          total_experience: section5.totalSeaService || '',
          last_vessel: section16.seaService?.[0]?.vesselName || '',
          last_rank: section16.seaService?.[0]?.rankHeld || '',
          coc_number: section8.certificates?.[0]?.certificateNumber || '',
          coc_issuing_country: section8.certificates?.[0]?.issuingAuthority || '',
          english_proficiency: section15.englishProficiency || '',
          marlins_score: section15.marlinsScore || '',
          bmi: section16.bmi || '',
          blood_group: section16.bloodGroup || '',
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

      if (appliedFilters.complianceStatus) {
        formattedData = formattedData.filter(app => app.compliance_status === appliedFilters.complianceStatus)
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

  const loadAllStatusCounts = async () => {
    try {
      const visibleQuery = applyRecruiterVisibilityFilter(
        supabase
          .from('applications')
          .select('status')
      )

      const { data: visibleData, error: visibleError } = await visibleQuery

      if (visibleError) throw visibleError

      const counts = {
        all: visibleData?.length || 0,
        submitted: 0,
        new: 0,
        under_review: 0,
        test_scheduled: 0,
        test_completed: 0,
        test_passed: 0,
        test_failed: 0,
        interview_scheduled: 0,
        interview_completed: 0,
        interview_passed: 0,
        offered: 0,
        hired: 0,
        rejected: 0,
        withdrawn: 0
      }

      visibleData?.forEach(app => {
        if (Object.prototype.hasOwnProperty.call(counts, app.status)) {
          counts[app.status]++
        }
      })

      setAllStatusCounts(counts)
    } catch (error) {
      console.error('Error loading status counts:', error)
    }
  }

  const filterApplications = () => {
    let filtered = [...applications]

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(app =>
        app.full_name?.toLowerCase().includes(term) ||
        app.email?.toLowerCase().includes(term) ||
        app.reference_number?.toLowerCase().includes(term) ||
        app.desired_rank?.toLowerCase().includes(term) ||
        app.vessel_type?.toLowerCase().includes(term) ||
        app.nationality?.toLowerCase().includes(term)
      )
    }

    if (complianceFilter !== 'all') {
      filtered = filtered.filter(app => app.compliance_status === complianceFilter)
    }

    setFilteredApplications(filtered)
  }

  const getStatusCounts = () => {
    // Return the separately fetched counts that include ALL applications
    return allStatusCounts
  }

 // --- CHANGED: STATUS CHANGE HANDLER WITH MODAL LOGIC & DB UPDATE ---
const updateContractEndDate = async (applicationId, value) => {
  try {
    const { error: updateError } = await supabase
      .from('applications')
      .update({ contract_end_date: value || null })
      .eq('id', applicationId)
    if (updateError) throw updateError
    const patch = (rows) => rows.map((row) => (row.id === applicationId ? { ...row, contract_end_date: value || null } : row))
    setApplications(patch)
    setFilteredApplications(patch)
  } catch (contractError) {
    console.error('Failed to update contract end date:', contractError)
    alert(`Could not save the contract end date${contractError?.message ? `: ${contractError.message}` : ''}`)
  }
}

const handleStatusChange = async (applicationId, newStatus) => {
  const appToUpdate = applications.find(a => a.id === applicationId)
  if (!appToUpdate) return

  // DELETED: Rejection intercept (now handled by TestResultModal)
  
  // 2. Handle "Simple" statuses (Direct DB Update)
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

    // Refresh derived queues and sidebar counts so submitted/reviewed items move immediately.
    await Promise.all([
      loadAllStatusCounts(),
      loadApplications(filters, { background: true })
    ])
  } catch (error) {
    console.error('Error updating status:', error)
    alert('Failed to update status')
  }
}

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
  }

  const handleApplyFilters = (filtersToApply = null) => {
    const activeFilters = filtersToApply || filters
    loadApplications(activeFilters)
  }

  const refreshEmbeddingReadiness = async () => {
    try {
      setEmbeddingReadinessLoading(true)
      const readiness = await getEmbeddingReadiness()
      setEmbeddingReadiness(readiness)
    } catch (error) {
      console.error('Error loading embedding readiness:', error)
      setEmbeddingReadiness({
        ready: false,
        needsGeneration: true,
        missing: [],
        stale: [],
      })
    } finally {
      setEmbeddingReadinessLoading(false)
    }
  }

const handleAISearchResults = async (results, query, isAnalyzing = false) => {
  setCurrentPage(1)
  setAiSearchResults(results)
  setAiSearchQuery(query)
  setAiSearchActive(true)
  setAnalyzingWithLLM(isAnalyzing)

  if (results.length === 0) {
    setAiSearchResults([])
    if (aiSearchStorageKey) {
      localStorage.removeItem(aiSearchStorageKey)
    }
    return
  }

  try {
    const applicationIds = results.map(r => r.application_id)

    const { data: fullApps, error } = await supabase
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
        application_data (
          data
        )
      `)
      .in('id', applicationIds)

    if (error) {
      console.error('Error fetching full applications:', error)
      setAiSearchResults(results)
      return
    }

	    const enrichedResults = fullApps.map(app => {
	      const appData = app.application_data?.data || {}
        const matchingResult = results.find(r => r.application_id === app.id)

	      return {
	        ...app,
	        full_name: `${appData.section2?.firstName || ''} ${appData.section2?.surname || ''}`.trim(),
	        email: appData.section2?.email || appData.section4?.email || '',
	        phone: appData.section2?.phoneNumber || appData.section4?.phoneNumber || '',
	        desired_rank: appData.section1?.appliedForRank || app.applied_rank || '',
	        vessel_type: appData.section1?.vesselType || '',
	        nationality: appData.section2?.nationality || '',
	        available_from: appData.section1?.availableFrom || '',
	        date_of_birth: appData.section2?.dateOfBirth || '',
	        similarity: matchingResult?.similarity || 0,
	        matched_chunk: matchingResult?.chunk_text || '',
	        llmAnalysis: matchingResult?.llmAnalysis
	      }
	    })

	    enrichedResults.sort((a, b) => {
        const scoreA = a.llmAnalysis?.confidence ?? a.similarity
        const scoreB = b.llmAnalysis?.confidence ?? b.similarity
        return scoreB - scoreA
      })
    
    setAiSearchResults(enrichedResults)
    
    // ✅ SAVE TO LOCALSTORAGE HERE - AFTER ENRICHMENT
    if (aiSearchStorageKey) {
      localStorage.setItem(aiSearchStorageKey, JSON.stringify({
        results: enrichedResults,
        query,
        timestamp: Date.now()
      }))
    }

  } catch (error) {
    console.error('Error enriching search results:', error)
    setAiSearchResults(results)
  }
}

  const handleClearAISearch = () => {
  setAiSearchActive(false)
  setAiSearchResults([])
  setAiSearchQuery('')
  setCurrentPage(1)
  filterApplications()
  
  // Clear from localStorage
  if (aiSearchStorageKey) {
    localStorage.removeItem(aiSearchStorageKey)
  }
}

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    )
  }

  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return data.slice(startIndex, endIndex)
  }

    const displayedApplications = activeTab === 'search' && searchMode === 'filters'
    ? applications
    : filteredApplications

  const displayedPaginatedApplications = getPaginatedData(displayedApplications)
  const displayedTotalPages = Math.ceil(displayedApplications.length / itemsPerPage)

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
        <div className="text-center">
          <p className="text-fg-secondary">You do not have permission to view applications.</p>
        </div>
      </div>
    )
  }

  const statusCounts = getStatusCounts()
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage)
  const paginatedApplications = getPaginatedData(filteredApplications)
  const activeStatusScopes = [
    includeActive && 'Active',
    includeHired && 'Hired',
    includeRejected && 'Rejected',
    includeWithdrawn && 'Withdrawn'
  ].filter(Boolean)

  const manualFilterChips = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({
      label: `${key}: ${typeof value === 'object' ? 'Date range' : value}`,
      onRemove: () => {
        const nextFilters = { ...filters }
        delete nextFilters[key]
        handleFilterChange(nextFilters)
      }
    }))

  const searchTabs = [
    { value: 'ai', label: 'AI Search', icon: Sparkles },
    { value: 'filters', label: 'Manual Search', icon: SlidersHorizontal }
  ]

  const toggleStatusScope = (scope) => {
    const setters = {
      active: setIncludeActive,
      hired: setIncludeHired,
      rejected: setIncludeRejected,
      withdrawn: setIncludeWithdrawn
    }

    setters[scope]?.(prev => !prev)
  }

  const setManualScope = (scope) => {
    if (scope === 'active') {
      setIncludeActive(true)
      setIncludeHired(false)
      setIncludeRejected(false)
      setIncludeWithdrawn(false)
      return
    }

    if (scope === 'archived') {
      setIncludeActive(false)
      setIncludeHired(true)
      setIncludeRejected(true)
      setIncludeWithdrawn(true)
      return
    }

    setIncludeActive(true)
    setIncludeHired(true)
    setIncludeRejected(true)
    setIncludeWithdrawn(true)
  }

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
            <th>Email</th>
            <th>Phone</th>
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
              <td colSpan={showRelevance ? 14 : 12} className="px-6 py-12 text-center text-fg-muted">
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
                <td className="tracker-cell--nowrap"><ComplianceBadge status={app.compliance_status} size="compact" /></td>
                <td className="tracker-cell--nowrap tracker-cell--muted">
                  <span className="block max-w-[13rem] truncate" title={app.email}>{app.email || '—'}</span>
                </td>
                <td className="tracker-cell--nowrap tracker-cell--muted">{app.phone || '—'}</td>
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
                    <SequentialStatusControl
                      applicationId={app.id}
                      currentStatus={app.status}
                      onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
                      application={app}
                      autoOpenInterview={autoOpenInterviewForApp === app.id}
                      onAutoOpenComplete={() => setAutoOpenInterviewForApp(null)}
                    />
                    <button
                      onClick={() => navigate(`/application/view/${app.public_token}`)}
                      className="inline-flex rounded-lg p-2 text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent-text"
                      title="View application"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {app.status === 'hired' ? (
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
      <RecruiterWorkspaceNav />

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto bg-surface/30">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-accent-text" />
            </div>
          ) : (
            <>
              {/* All Applications Tab */}
              {activeTab === 'all' && (
                <div className="space-y-6">
                  <PageHeader
                    title="Applications"
                    actions={backgroundRefreshing ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-2 text-sm text-fg-secondary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Syncing updates
                      </div>
                    ) : null}
                  />

                  <div className="recruiter-panel overflow-hidden">
                    <div className="grid min-h-[38rem] lg:grid-cols-[18rem_minmax(0,1fr)]">
                      <aside className="border-b border-line bg-surface p-4 lg:border-b-0 lg:border-r lg:p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowDetailedStatusNav(prev => !prev)}
                            className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-xs font-medium text-fg-secondary transition hover:bg-raised"
                          >
                            <PanelLeft className="h-3.5 w-3.5" />
                            {showDetailedStatusNav ? 'Hide menu' : 'Show menu'}
                          </button>
                        </div>

                        <div className="space-y-4">
                          {statusGroups.map(group => {
                            const GroupIcon = group.icon
                            const isExpanded = expandedGroups.includes(group.id)
                            const groupTotal = group.statuses.reduce((sum, status) =>
                              sum + (statusCounts[status.value] || 0), 0
                            ) - (group.id === 'initial' ? (statusCounts.all || 0) : 0)
                            const primaryStatus = group.statuses[0]
                            const primaryCount = group.id === 'initial'
                              ? (statusCounts.all || 0)
                              : groupTotal

                            return (
                              <div key={group.id} className="rounded-card border border-line bg-surface/85">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!showDetailedStatusNav) {
                                      updateStatusFilter(primaryStatus.value)
                                      return
                                    }
                                    toggleGroup(group.id)
                                  }}
                                  className="w-full rounded-control px-4 py-3 text-left transition hover:bg-raised"
                                >
                                  <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      {showDetailedStatusNav ? (
                                        isExpanded ? (
                                          <ChevronDown className="h-4 w-4 flex-shrink-0 text-fg-muted" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-fg-muted" />
                                        )
                                      ) : null}
                                      <GroupIcon className="h-4 w-4 flex-shrink-0 text-fg-muted" />
                                      <span className="truncate text-sm font-semibold text-fg">{group.label}</span>
                                    </div>
                                    <span className={`inline-flex h-6 min-w-10 items-center justify-center rounded-full px-2 text-xs font-medium ${
 !showDetailedStatusNav && statusFilter === primaryStatus.value
 ? 'bg-accent-soft text-accent-text'
 : 'bg-raised text-fg-secondary'
 }`}>
                                      {primaryCount}
                                    </span>
                                  </div>

                                  {!showDetailedStatusNav ? (
                                    <div className="mt-2 pl-6 text-xs text-fg-muted">
                                      {primaryStatus.label}
                                    </div>
                                  ) : null}
                                </button>

                                {showDetailedStatusNav && isExpanded ? (
                                  <div className="border-t border-line px-3 py-3">
                                    <div className="space-y-2">
                                      {group.statuses.map(status => (
                                        <button
                                          key={status.value}
                                          type="button"
                                          onClick={() => updateStatusFilter(status.value)}
                                          className={`w-full rounded-control border px-3 py-2.5 text-left text-sm transition ${
 statusFilter === status.value
 ? 'border-accent/40 bg-accent-soft text-accent-text'
 : 'border-line bg-surface text-fg-secondary hover:border-line-input hover:bg-raised'
 }`}
                                        >
                                          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                                            <span className="truncate font-medium">{status.label}</span>
                                            <span className={`inline-flex h-6 min-w-9 items-center justify-center rounded-full px-2 text-xs font-medium ${
 statusFilter === status.value
 ? 'bg-accent-soft text-accent-text'
 : 'bg-raised text-fg-secondary'
 }`}>
                                              {statusCounts[status.value] || 0}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </aside>

                      <div className="min-w-0 bg-surface/65">
                        <div className="border-b border-line/80 px-5 py-4 md:px-6">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm font-medium text-fg-secondary">
                                  {filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''} found
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <ComplianceBadge status="red" summary={complianceCounts.red} size="compact" />
                                  <ComplianceBadge status="amber" summary={complianceCounts.amber} size="compact" />
                                  <ComplianceBadge status="green" summary={complianceCounts.green} size="compact" />
                                </div>
                                <span className="text-xs text-fg-muted">
                                  {includeRejected ? '(Rejected candidates included)' : '(Rejected candidates hidden)'}
                                </span>
                              </div>

                              {statusFilter === 'all' && (
                                <label htmlFor="includeRejected" className="inline-flex items-center gap-2 text-sm text-fg-secondary cursor-pointer">
                                  <input
                                    type="checkbox"
                                    id="includeRejected"
                                    checked={includeRejected}
                                    onChange={(e) => setIncludeRejected(e.target.checked)}
                                    className="h-4 w-4 rounded border-line-input text-accent-text focus:ring-accent"
                                  />
                                  <span>Include Rejected Candidates</span>
                                </label>
                              )}
                            </div>

                            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[34rem] xl:flex-row xl:items-center xl:justify-end">
                              <div className="relative w-full xl:w-96">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
                                <input
                                  type="text"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  placeholder="Search by name, email, reference..."
                                  className="w-full rounded-card border border-line-input bg-surface pl-10 pr-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-accent"
                                />
                              </div>
                              <div className="w-full xl:w-48">
                                <select
                                  value={complianceFilter}
                                  onChange={(e) => setComplianceFilter(e.target.value)}
                                  className="w-full rounded-control border border-line-input bg-surface px-4 py-2.5 text-sm text-fg-secondary focus:border-transparent focus:ring-2 focus:ring-accent"
                                >
                                  <option value="all">All compliance</option>
                                  <option value="red">Red</option>
                                  <option value="amber">Amber</option>
                                  <option value="green">Green</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6 p-5 md:p-6">
                          <ApplicationTable apps={paginatedApplications} showRelevance={aiSearchActive} />

                          {filteredApplications.length > 0 && (
                            <Pagination
                              currentPage={currentPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentPage}
                              itemsPerPage={itemsPerPage}
                              totalItems={filteredApplications.length}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Search Tab */}
              {activeTab === 'search' && (
                <div className="workspace-surface-grid">
                  <PageHeader
                    title="Search"
                    actions={<SegmentedControl options={searchTabs} value={searchMode} onChange={setSearchMode} />}
                  />

                  {searchMode === 'ai' && (
                    <>
                      <div className="recruiter-panel p-5 md:p-6">
                        <div className="space-y-5">
                          <div>
                            <h3 className="mt-2 text-xl font-semibold tracking-tight text-fg">Describe the profile you need</h3>
                          </div>

                          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                            <div className="rounded-card border border-line bg-surface/85 p-5">
                              <p className="text-sm font-medium text-fg">Prompt</p>
                              {embeddingReadinessLoading ? (
                                <div className="mt-4 rounded-control border border-line bg-raised px-4 py-3 text-sm text-fg-secondary">
                                  Checking embedding readiness...
                                </div>
                              ) : null}
                              <div className="mt-4">
                                <AISearch
                                  onResults={(results, query, isAnalyzing) => handleAISearchResults(results, query, isAnalyzing)}
                                  onLoading={setAiSearchLoading}
                                  onClearSearch={handleClearAISearch}
                                  embeddingsReady={Boolean(embeddingReadiness?.ready)}
                                  embeddingStatusMessage={formatEmbeddingStatusMessage(embeddingReadiness)}
                                  onRequireEmbeddings={() => {
                                    const target = document.getElementById('embedding-setup-panel')
                                    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }}
                                />
                              </div>
                            </div>

                            <div id="embedding-setup-panel" className="rounded-card border border-line bg-surface/85 p-5">
                              <h4 className="mt-2 text-lg font-semibold text-fg">Generate embeddings once.</h4>
                              <div className="mt-4">
                                <EmbeddingGenerator
                                  onGenerated={() => {
                                    refreshEmbeddingReadiness()
                                  }}
                                  onFailed={() => {
                                    refreshEmbeddingReadiness()
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {aiSearchLoading && aiSearchResults.length === 0 ? (
                        <div className="recruiter-panel p-8">
                          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
                            <div>
                              <p className="text-sm font-medium text-fg">Running AI Search</p>
                            </div>
                          </div>
                        </div>
                      ) : aiSearchResults.length > 0 ? (
                        <>
                          <WorkspaceToolbar
                            title={`${aiSearchResults.length} AI search result${aiSearchResults.length === 1 ? '' : 's'}`}
                            actions={(
                              <>
                                {analyzingWithLLM ? (
                                  <span className="rounded-full bg-accent-soft px-3 py-2 text-sm font-medium text-accent-text">
                                    AI confidence is still enriching top matches
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={handleClearAISearch}
                                  className="workspace-action-button workspace-action-button--secondary"
                                >
                                  Clear search
                                </button>
                              </>
                            )}
                          />

                          <ApplicationTable
                            apps={aiSearchResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                            showRelevance={true}
                            analyzingWithLLM={analyzingWithLLM}
                          />
                          <Pagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(aiSearchResults.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                            itemsPerPage={itemsPerPage}
                            totalItems={aiSearchResults.length}
                          />
                        </>
                      ) : (
                        <EmptyState
                          icon={Sparkles}
                          title="No AI search has been run yet"
                        />
                      )}
                    </>
                  )}

                  {searchMode === 'filters' && (
                    <>
                      <div className="recruiter-panel p-5 md:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-fg">Manual Search</p>
                          </div>
                          <div className="inline-flex rounded-card border border-line bg-surface p-1">
                            <button
                              type="button"
                              onClick={() => setManualScope('active')}
                              className={`rounded-control px-4 py-2 text-sm font-medium transition ${
 includeActive && !includeHired && !includeRejected && !includeWithdrawn
 ? 'bg-accent-fill text-on-accent'
 : 'text-fg-secondary hover:bg-raised'
 }`}
                            >
                              Active
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualScope('archived')}
                              className={`rounded-control px-4 py-2 text-sm font-medium transition ${
 !includeActive && includeHired && includeRejected && includeWithdrawn
 ? 'bg-accent-fill text-on-accent'
 : 'text-fg-secondary hover:bg-raised'
 }`}
                            >
                              Archived
                            </button>
                          </div>
                        </div>
                      </div>

                      <ApplicationFilters
                        onFilterChange={handleFilterChange}
                        onApplyFilters={handleApplyFilters}
                        activeFilters={filters}
                      />

                      {displayedApplications.length > 0 ? (
                        <>
                          <WorkspaceToolbar
                            title={`${displayedApplications.length} candidate${displayedApplications.length === 1 ? '' : 's'}`}
                            chips={manualFilterChips}
                            actions={(
                              <button
                                type="button"
                                onClick={() => {
                                  setFilters({})
                                  handleApplyFilters({})
                                }}
                                className="workspace-action-button workspace-action-button--secondary"
                              >
                                Reset filters
                              </button>
                            )}
                          />
                          <ApplicationTable apps={displayedPaginatedApplications} />
                          {displayedApplications.length > 0 && (
                            <Pagination
                              currentPage={currentPage}
                              totalPages={displayedTotalPages}
                              onPageChange={setCurrentPage}
                              itemsPerPage={itemsPerPage}
                              totalItems={displayedApplications.length}
                            />
                          )}
                        </>
                      ) : (
                        <EmptyState
                          icon={SlidersHorizontal}
                          title="No candidates match these manual filters"
                          action={(
                            <button
                              type="button"
                              onClick={() => {
                                setFilters({})
                                handleApplyFilters({})
                              }}
                              className="workspace-action-button workspace-action-button--secondary"
                            >
                              Clear manual filters
                            </button>
                          )}
                        />
                      )}
                    </>
                  )}
                </div>
              )}

            </>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
