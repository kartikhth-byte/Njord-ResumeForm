import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import { formatDisplayValue } from '../utils/formatUtils'
import SequentialStatusControl from '../components/SequentialStatusControl'
import ApplicationFilters from '../components/ApplicationFilters'
import Pagination from '../components/Pagination'
import EmbeddingGenerator from '../components/EmbeddingGenerator'
import AISearch from '../components/AISearch'
import OfferModal from '../components/recruiter/OfferModal'
import ConfidenceBadge from '../components/ConfidenceBadge'


// --- ADDED MODAL IMPORTS ---
import RejectionModal from '../components/recruiter/RejectionModal'

import { 
  Users, 
  Search, 
  Eye, 
  Loader2, 
  LayoutList, 
  Search as SearchIcon, 
  TrendingUp, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Clock,
  CheckCircle,
  Menu,
  X as XIcon
} from 'lucide-react'


export default function RecruiterApplications() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { canViewApplications, loading: permLoading } = usePermissions(user)
  
  const [applications, setApplications] = useState([])
  const [autoOpenInterviewForApp, setAutoOpenInterviewForApp] = useState(null)  // ← ADD THIS
const [allApplicationsForPipeline, setAllApplicationsForPipeline] = useState([])  // ← ADD THIS
const [analyzingWithLLM, setAnalyzingWithLLM] = useState(false)


  // Add this useEffect near the top of RecruiterApplications component
useEffect(() => {
  console.log('🔍 Checking for teams_connected parameter...')

  const urlParams = new URLSearchParams(window.location.search)
  const teamsConnected = urlParams.get('teams_connected')
  const applicationId = localStorage.getItem('reopen_interview_modal')

  console.log('🔍 URL params:', { teamsConnected, applicationId, applicationsCount: applications.length })
  
  if (teamsConnected === 'true' && applicationId) {
    console.log('✅ Found teams_connected, checking if applications loaded...')
    
    // Wait until applications are actually loaded
    if (applications.length === 0) {
      console.log('⏳ Applications not loaded yet, waiting...')
      return
    }

    console.log('✅ Applications loaded, searching for application...')
    
    const app = applications.find(a => a.id === applicationId)
    console.log('🔍 Found application:', app)

    if (app) {
      console.log('✅ Reopening modal for application:', app.id)
      
      // Clean up
      localStorage.removeItem('reopen_interview_modal')
      window.history.replaceState({}, '', '/recruiter/applications')
      
      // Tell SequentialStatusControl to auto-open
      setAutoOpenInterviewForApp(app.id)
      
      // Clear after a moment
      //setTimeout(() => setAutoOpenInterviewForApp(null), 1000)
    } else {
      console.log('❌ Application not found in loaded list')
      localStorage.removeItem('reopen_interview_modal')
      window.history.replaceState({}, '', '/recruiter/applications')
    }
  }
}, [applications])

  const [filteredApplications, setFilteredApplications] = useState([])
  const [allStatusCounts, setAllStatusCounts] = useState({}) // New: stores counts of ALL applications
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Initialize statusFilter from URL or default to 'all'
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [filters, setFilters] = useState({})
  const [includeRejected, setIncludeRejected] = useState(false) // Include rejected candidates
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false) // Include withdrawn candidates  
  const [includeHired, setIncludeHired] = useState(false) // Include hired candidates
  const [includeActive, setIncludeActive] = useState(true) // Include active candidates (default: true)
  
const [isOfferModalOpen, setIsOfferModalOpen] = useState(false)
const [offerApplication, setOfferApplication] = useState(null)

  // Tab management - initialize from URL or default to 'all'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all')
  
  // Helper function to update tab and URL
  const updateActiveTab = (newTab) => {
      console.log('🔄 Switching tab:', activeTab, '→', newTab)
  console.log('  - aiSearchResults before switch:', aiSearchResults.length)

    setActiveTab(newTab)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', newTab)
    if (statusFilter && statusFilter !== 'all') {
      newParams.set('status', statusFilter)
    }
    setSearchParams(newParams, { replace: true })
      console.log('  - aiSearchResults after switch:', aiSearchResults.length)

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
    const tabFromUrl = searchParams.get('tab') || 'all'
    const statusFromUrl = searchParams.get('status') || 'all'
    
    console.log('🔍 URL changed - Tab:', tabFromUrl, 'Status:', statusFromUrl)
    console.log('🔍 Current state - Tab:', activeTab, 'Status:', statusFilter)
    
    // Only update if different to avoid infinite loops
    setActiveTab(prev => {
      if (prev !== tabFromUrl) {
        console.log('✅ Updating activeTab from', prev, 'to', tabFromUrl)
        return tabFromUrl
      }
      return prev
    })
    setStatusFilter(prev => {
      if (prev !== statusFromUrl) {
        console.log('✅ Updating statusFilter from', prev, 'to', statusFromUrl)
        return statusFromUrl
      }
      return prev
    })
  }, [searchParams])
  

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  
  // AI Search
  const [aiSearchActive, setAiSearchActive] = useState(false)
  const [aiSearchResults, setAiSearchResults] = useState([])
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  
  // Advanced Search mode toggle
  const [searchMode, setSearchMode] = useState('ai')
  
  // Status Pipeline
  const [expandedStatuses, setExpandedStatuses] = useState(['new'])
  
  // Sidebar - responsive default: closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(['initial', 'testing', 'interview', 'final'])

  // --- MODAL STATES ---
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState(null)

  
  // Handle sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      // Open sidebar on desktop (>= 1024px), close on mobile
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }
    
    // Set initial state
    handleResize()
    
    // Listen for resize
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Status groups for sidebar
  const statusGroups = [
    {
      id: 'initial',
      label: 'Initial Stage',
      icon: FileText,
      statuses: [
        { value: 'all', label: 'All Applications', count: 0 },
        { value: 'new', label: 'New', count: 0 },
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
          loadAllApplicationsForPipeline()  // ← ADD THIS
    }
  }, [permLoading, includeRejected, includeWithdrawn, includeHired, includeActive]) // Reload when any status filter changes

useEffect(() => {
    console.log('🔄 useEffect triggered - activeTab:', activeTab, 'aiSearchActive:', aiSearchActive)

  // Only filter for "All Applications" tab when NOT doing AI search
  if (activeTab === 'all' && !aiSearchActive) {
        console.log('✅ Calling filterApplications()')
            filterApplications()
   } else {
    console.log('❌ NOT calling filterApplications()')
  }
}, [activeTab, applications, statusFilter, searchTerm, includeRejected, aiSearchActive])
  
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchTerm, filters])

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
  console.log('🔄 Checking for saved AI search results...')
  
  const savedSearch = localStorage.getItem('aiSearchResults')
  if (!savedSearch) {
    console.log('❌ No saved search results found')
    return
  }

  try {
    const { results, query, timestamp } = JSON.parse(savedSearch)
    
    // Only restore if less than 30 minutes old
    const THIRTY_MINUTES = 30 * 60 * 1000
    const age = Date.now() - timestamp
    
    if (age < THIRTY_MINUTES) {
      console.log(`✅ Restoring ${results.length} AI search results (${Math.round(age / 1000 / 60)} minutes old)`)
      
      setAiSearchResults(results)
      setAiSearchQuery(query)
      setAiSearchActive(true)
      
      // Switch to search tab if we have results
      if (results.length > 0 && activeTab !== 'search') {
        updateActiveTab('search')
      }
    } else {
      console.log(`⏰ Saved results too old (${Math.round(age / 1000 / 60)} minutes), clearing...`)
      localStorage.removeItem('aiSearchResults')
    }
  } catch (error) {
    console.error('❌ Error restoring search results:', error)
    localStorage.removeItem('aiSearchResults')
  }
}, []) // Empty dependency array - run once on mount

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

  const loadApplications = async (appliedFilters = {}) => {
    try {
      setLoading(true)

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
          application_data (
            data
          )
        `)
        .not('submitted_at', 'is', null)

      // Comprehensive status filtering based on checkboxes
      const statusesToInclude = []
      
      if (includeActive) {
        // Active statuses = not terminal (not hired, rejected, withdrawn)
        statusesToInclude.push(
          'new', 'under_review', 'test_scheduled', 'test_completed', 'test_passed', 
          'test_failed', 'interview_scheduled', 'interview_completed', 'interview_passed',
          'second_interview_scheduled', 'second_interview_completed', 
          'offered', 'offer_accepted', 'documents_pending'
        )
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
          experience_years: calculateExperience(section5.seaService),
          available_from: section1.availableFrom || '',
          total_experience: section5.totalSeaService || '',
          last_vessel: section5.seaService?.[0]?.vesselName || '',
          last_rank: section5.seaService?.[0]?.rank || '',
          coc_number: section8.cocNumber || '',
          coc_issuing_country: section8.issuingCountry || '',
          english_proficiency: section15.englishProficiency || '',
          marlins_score: section15.marlinsScore || '',
          bmi: section16.bmi || '',
          blood_group: section16.bloodGroup || ''
        }
      })

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
          const appData = app.application_data?.data
          // Check section 8 for certificate grade
          const certificates = appData?.section8?.certificates || []
          return certificates.some(cert => 
            cert.certificateGrade === appliedFilters.certificateGrade
          )
        })
      }

      // Visa Type filter
      if (appliedFilters.visaType) {
        formattedData = formattedData.filter(app => {
          const appData = app.application_data?.data
          // Check section 5 for visas
          const visas = appData?.section5?.visas || []
          return visas.some(visa => 
            visa.visaType === appliedFilters.visaType
          )
        })
      }

      // Flag State filter
      if (appliedFilters.flagState) {
        formattedData = formattedData.filter(app => {
          const appData = app.application_data?.data
          // Check section 15 for endorsements
          const endorsements = appData?.section15?.endorsements || []
          return endorsements.some(endorsement => 
            endorsement.flagState === appliedFilters.flagState
          )
        })
      }

      setApplications(formattedData)
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllStatusCounts = async () => {
    try {
      // Fetch ALL applications (including rejected) just for counting
      const { data, error } = await supabase
        .from('applications')
        .select('status')
        .not('submitted_at', 'is', null)

      if (error) throw error

      const counts = {
        all: data?.length || 0,
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

      data?.forEach(app => {
        if (counts.hasOwnProperty(app.status)) {
          counts[app.status]++
        }
      })

      setAllStatusCounts(counts)
    } catch (error) {
      console.error('Error loading status counts:', error)
    }
  }

  const loadAllApplicationsForPipeline = async () => {
  try {
    // Load ALL applications without any filters for pipeline view
    const { data, error } = await supabase
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
        application_data (
          data
        )
      `)
      .not('submitted_at', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform data same as loadApplications
    const transformed = data.map(app => ({
      ...app,
      full_name: `${app.application_data?.data?.section2?.firstName || ''} ${app.application_data?.data?.section2?.surname || ''}`.trim(),
      email: app.application_data?.data?.section2?.email || app.application_data?.data?.section4?.email || '',
      phone: app.application_data?.data?.section2?.phoneNumber || app.application_data?.data?.section4?.phoneNumber || '',
      desired_rank: app.application_data?.data?.section2?.desiredRank || app.applied_rank || '',
      vessel_type: app.application_data?.data?.section2?.vesselType || '',
      nationality: app.application_data?.data?.section2?.nationality || '',
      available_from: app.application_data?.data?.section2?.availableFrom || '',
      date_of_birth: app.application_data?.data?.section2?.dateOfBirth || ''
    }))

    setAllApplicationsForPipeline(transformed)
  } catch (error) {
    console.error('Error loading all applications for pipeline:', error)
  }
}

  const filterApplications = () => {
      console.log('🔍 filterApplications called')
  console.log('📊 applications.length:', applications.length)
  console.log('📊 statusFilter:', statusFilter)
  console.log('📊 searchTerm:', searchTerm)

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

      console.log('✅ Filtered results:', filtered.length)

    setFilteredApplications(filtered)
  }

  const getStatusCounts = () => {
    // Return the separately fetched counts that include ALL applications
    return allStatusCounts
  }

 // --- CHANGED: STATUS CHANGE HANDLER WITH MODAL LOGIC & DB UPDATE ---
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
  } catch (error) {
    console.error('Error updating status:', error)
    alert('Failed to update status')
  }
}

  // --- MODAL CALLBACKS ---
  const handleRejectConfirm = async (rejectionData) => {
    const appId = rejectionData.applicationId
    // Update local UI to reflect rejection (DB update handled by Modal/Service)
    setApplications(prev => prev.map(app => 
      app.id === appId ? { ...app, status: 'rejected' } : app
    ))
    setIsRejectionModalOpen(false)
    setIsRetakeModalOpen(false) 
  }

  
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
  }

  const handleApplyFilters = (filtersToApply = null) => {
    const activeFilters = filtersToApply || filters
    loadApplications(activeFilters)
  }

const handleAISearchResults = async (results, query, isAnalyzing = false) => {
  console.log('🔍 AI Search results received:', results.length)
  
  setAiSearchResults(results)
  setAiSearchQuery(query)
  setAiSearchActive(true)
  setAnalyzingWithLLM(isAnalyzing)

  if (results.length === 0) {
    setAiSearchResults([])
    localStorage.removeItem('aiSearchResults')
    return
  }

  try {
    const applicationIds = results.map(r => r.application_id)
    
    console.log('📊 Fetching full application data for IDs:', applicationIds)

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

    console.log('✅ Fetched full application data:', fullApps.length)

    const enrichedResults = fullApps.map(app => {
      const appData = app.application_data?.data || {}
      
      return {
        ...app,
        full_name: `${appData.section2?.firstName || ''} ${appData.section2?.surname || ''}`.trim(),
        email: appData.section2?.email || appData.section4?.email || '',
        phone: appData.section2?.phoneNumber || appData.section4?.phoneNumber || '',
        desired_rank: appData.section2?.desiredRank || app.applied_rank || '',
        vessel_type: appData.section1?.vesselType || '',
        nationality: appData.section2?.nationality || '',
        available_from: appData.section2?.availableFrom || '',
        date_of_birth: appData.section2?.dateOfBirth || '',
        similarity: results.find(r => r.application_id === app.id)?.similarity || 0,
        matched_chunk: results.find(r => r.application_id === app.id)?.chunk_text || '',
        llmAnalysis: results.find(r => r.application_id === app.id)?.llmAnalysis
      }
    })

    enrichedResults.sort((a, b) => b.similarity - a.similarity)

    console.log('✅ Enriched results with metadata:', enrichedResults.length)
    
    setAiSearchResults(enrichedResults)
    
    // ✅ SAVE TO LOCALSTORAGE HERE - AFTER ENRICHMENT
    localStorage.setItem('aiSearchResults', JSON.stringify({
      results: enrichedResults,  // ← Save enriched results!
      query,
      timestamp: Date.now()
    }))
    console.log('💾 Saved enriched AI search results to localStorage')

  } catch (error) {
    console.error('Error enriching search results:', error)
    setAiSearchResults(results)
  }
}

  const handleClearAISearch = () => {
  console.log('🧹 Clearing AI search results')
  
  setAiSearchActive(false)
  setAiSearchResults([])
  setAiSearchQuery('')
  filterApplications()
  
  // Clear from localStorage
  localStorage.removeItem('aiSearchResults')
  console.log('💾 Cleared AI search results from localStorage')
}

  const toggleStatus = (statusValue) => {
    setExpandedStatuses(prev =>
      prev.includes(statusValue)
        ? prev.filter(s => s !== statusValue)
        : [...prev, statusValue]
    )
  }

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    )
  }

  const getPaginatedData = (data) => {
    console.log('📄 getPaginatedData called')
  console.log('📊 Input data length:', data.length)
  console.log('📊 currentPage:', currentPage)
  console.log('📊 itemsPerPage:', itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
      console.log('📊 startIndex:', startIndex, 'endIndex:', endIndex)
        const result = data.slice(startIndex, endIndex)

        console.log('📊 Paginated result length:', result.length)
  return result
  }

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!canViewApplications()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">You do not have permission to view applications.</p>
        </div>
      </div>
    )
  }

  const statusCounts = getStatusCounts()
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage)
  const paginatedApplications = getPaginatedData(filteredApplications)

const ApplicationTable = ({ apps, showRelevance = false, analyzingWithLLM = false }) => {
    console.log('🎨 ApplicationTable rendering - apps:', apps.length, 'showRelevance:', showRelevance)

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-visible">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full overflow-visible">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vessel Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted
              </th>
{showRelevance && (
  <>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      Relevance
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      AI Match
    </th>
  </>
)}
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Actions
</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                View
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 overflow-visible">
            {apps.length === 0 ? (
              <tr>
                <td colSpan="11" className="px-6 py-12 text-center text-gray-500">
                  No applications found
                </td>
              </tr>
            ) : (
              apps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors overflow-visible">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-blue-600 font-medium">
                      {app.reference_number}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{app.full_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">{app.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{app.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{formatDisplayValue(app.desired_rank)}</div>
                  </td>
                  <td className="px-6 py-4">
<div className="flex items-center gap-2">
  <div className="text-sm text-gray-900">{formatDisplayValue(app.vessel_type)}</div>
</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '-'}
                    </div>
                  </td>
{showRelevance && (
  <>
    {/* Relevance Column */}
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
            style={{ width: `${app.similarity * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600">
          {(app.similarity * 100).toFixed(0)}%
        </span>
      </div>
    </td>
    
{/* AI Match Column */}
<td className="px-6 py-4">
  {analyzingWithLLM && !app.llmAnalysis ? (
    <div className="flex items-center gap-2 text-purple-600">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
      <span className="text-xs font-medium">Analyzing...</span>
    </div>
  ) : app.llmAnalysis ? (
    <ConfidenceBadge llmAnalysis={app.llmAnalysis} compact={true} />
  ) : (
    <span className="text-xs text-gray-400">—</span>
  )}
</td>
  </>
)}

{/* Actions Column */}
<td className="px-6 py-4">
  <div className="flex items-center gap-2">
    <SequentialStatusControl
      applicationId={app.id}
      currentStatus={app.status}
      onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
      application={app}
      autoOpenInterview={autoOpenInterviewForApp === app.id}
      onAutoOpenComplete={() => setAutoOpenInterviewForApp(null)}
    />
    {/* Show dash for terminal statuses (rejected, withdrawn, hired) */}
    {(app.status === 'rejected' || app.status === 'withdrawn' || app.status === 'hired') && (
      <span className="text-gray-400 text-sm">—</span>
    )}
  </div>
</td>
                  {/* View Column */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => navigate(`/application/view/${app.public_token || app.id}`)}
                      className="inline-flex p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View application"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Vertical Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-30
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-300 ease-in-out
        w-72 bg-white border-r border-gray-200 flex flex-col
      `}>
        {/* Back to Dashboard Button - Very Top */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => navigate('/recruiter/dashboard')}
            className="w-full px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-300 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Status Filter</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {statusGroups.map(group => {
            const GroupIcon = group.icon
            const isExpanded = expandedGroups.includes(group.id)
            const groupTotal = group.statuses.reduce((sum, status) => 
              sum + (statusCounts[status.value] || 0), 0
            ) - (group.id === 'initial' ? (statusCounts.all || 0) : 0) // Only subtract "all" from initial stage

            return (
              <div key={group.id} className="space-y-1">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between p-2 text-left rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <GroupIcon className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                      {group.label}
                    </span>
                  </div>
                  {group.id !== 'initial' && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {groupTotal}
                    </span>
                  )}
                </button>

                {/* Group Statuses */}
                {isExpanded && (
                  <div className="ml-6 space-y-1">
                    {group.statuses.map(status => (
                      <button
                        key={status.value}
                        onClick={() => updateStatusFilter(status.value)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all
                          ${statusFilter === status.value
                            ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }
                        `}
                      >
                        <span>{status.label}</span>
                        <span className={`
                          px-2 py-0.5 rounded-full text-xs font-medium
                          ${statusFilter === status.value
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                          }
                        `}>
                          {statusCounts[status.value] || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
                  <p className="text-sm text-gray-600">Manage and track all applications</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 px-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
<button
  onClick={() => {
    updateActiveTab('all')
    setCurrentPage(1)
    setAiSearchActive(false)
    filterApplications()
    // Don't clear localStorage here - let users return to search results
  }}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LayoutList className="w-5 h-5" />
              All Applications
              <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${
                activeTab === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-900'
              }`}>
                {applications.length}
              </span>
            </button>
            
            <button
              onClick={() => {
                updateActiveTab('search')
                setCurrentPage(1)
              }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SearchIcon className="w-5 h-5" />
              Advanced Search
            </button>
            
            <button
              onClick={() => {
                updateActiveTab('pipeline')
                setCurrentPage(1)
              }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'pipeline'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Status Pipeline
            </button>
          </nav>
        </div>

        {/* Search Bar (Only in All Applications Tab) */}
        {activeTab === 'all' && (
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">
                  {filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''} found
                </p>
                <span className="text-xs text-gray-500">
                  {includeRejected ? '(All candidates visible)' : '(Rejected candidates hidden)'}
                </span>
              </div>

              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, reference..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            
            {/* Include Rejected Checkbox - Only show when viewing "All Applications" */}
            {statusFilter === 'all' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeRejected"
                  checked={includeRejected}
                  onChange={(e) => setIncludeRejected(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includeRejected" className="text-sm text-gray-700 cursor-pointer">
                  Include Rejected Candidates
                </label>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* All Applications Tab */}
              {activeTab === 'all' && (
                <div className="space-y-6">
   {console.log('📊 Rendering All Applications:')}
    {console.log('  - filteredApplications:', filteredApplications.length)}
    {console.log('  - paginatedApplications:', paginatedApplications.length)}
    {console.log('  - paginatedApplications data:', paginatedApplications)}

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
              )}

              {/* Advanced Search Tab */}
              {activeTab === 'search' && (
                <div className="space-y-6">
                      {console.log('🔍 Advanced Search Tab Rendering')}
    {console.log('  - aiSearchResults.length:', aiSearchResults.length)}
    {console.log('  - aiSearchResults:', aiSearchResults)}
    {console.log('  - searchMode:', searchMode)}
                  <EmbeddingGenerator />

                  <div className="flex items-center gap-4 bg-white rounded-lg border p-4">
                    <span className="text-sm font-medium text-gray-700">Search Mode:</span>
                    <button
                      onClick={() => setSearchMode('ai')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        searchMode === 'ai'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🤖 AI Search
                    </button>
                    <button
                      onClick={() => setSearchMode('filters')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        searchMode === 'filters'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🎛️ Manual Filters
                    </button>
                  </div>

                  {/* Comprehensive Status Filters for Candidate Database */}
                  <div className="bg-white rounded-lg border p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">📋 Filter by Candidate Status</h3>
                      <p className="text-xs text-gray-600">Search candidates by their application history and current status</p>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer group hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={includeActive}
                          onChange={(e) => setIncludeActive(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">🔵</span>
                          <span className="text-sm text-gray-700 font-medium">Active</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={includeHired}
                          onChange={(e) => setIncludeHired(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">✅</span>
                          <span className="text-sm text-gray-700 font-medium">Hired</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={includeRejected}
                          onChange={(e) => setIncludeRejected(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">❌</span>
                          <span className="text-sm text-gray-700 font-medium">Rejected</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={includeWithdrawn}
                          onChange={(e) => setIncludeWithdrawn(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">⚪</span>
                          <span className="text-sm text-gray-700 font-medium">Withdrawn</span>
                        </div>
                      </label>
                    </div>

                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-500">
                        {!includeRejected && !includeWithdrawn && !includeHired && !includeActive && 
                          "⚠️ Select at least one status to see results"}
                        {(includeRejected || includeWithdrawn || includeHired || includeActive) && 
                          `Showing: ${[
                            includeActive && 'Active',
                            includeHired && 'Hired', 
                            includeRejected && 'Rejected',
                            includeWithdrawn && 'Withdrawn'
                          ].filter(Boolean).join(', ')} candidates`}
                      </p>
                    </div>
                  </div>

              {searchMode === 'ai' && (
  <>
    <AISearch 
  onResults={(results, query, isAnalyzing) => handleAISearchResults(results, query, isAnalyzing)}
  onLoading={setLoading}
  onClearSearch={handleClearAISearch}
    />
{/* Clear Button - Show when results exist */}
{aiSearchResults.length > 0 && !analyzingWithLLM && (
  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
    <div className="flex items-center gap-2 text-sm text-blue-700">
      <span className="font-semibold">📋 {aiSearchResults.length} results found</span>
      {aiSearchQuery && <span className="text-blue-600">for "{aiSearchQuery}"</span>}
    </div>
    <button
      onClick={handleClearAISearch}
      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors font-medium"
    >
      ✕ Clear Search
    </button>
  </div>
)}    
{aiSearchResults.length > 0 && (
  <>
    {/* Progress Banner */}
    {analyzingWithLLM && (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-purple-900">
              🧠 AI Analysis in Progress...
            </p>
            <p className="text-xs text-purple-700 mt-1">
              Analyzing {aiSearchResults.filter(app => !app.llmAnalysis).length} of {aiSearchResults.length} applications with advanced reasoning. 
              Confidence scores will appear shortly (10-15 seconds).
            </p>
          </div>
        </div>
      </div>
    )}

    <ApplicationTable apps={aiSearchResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)} showRelevance={true} />
    {aiSearchResults.length > 0 && (
      <Pagination
       currentPage={currentPage}
        totalPages={Math.ceil(aiSearchResults.length / itemsPerPage)}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={aiSearchResults.length}
      />
    )}
  </>
)}
                    </>
                  )}

                  {searchMode === 'filters' && (
                    <>
                      <ApplicationFilters 
                        onFilterChange={handleFilterChange}
                        onApplyFilters={handleApplyFilters}
                        activeFilters={filters}
                      />
                      {applications.length > 0 && (
                        <>
                          <ApplicationTable apps={paginatedApplications} />
                          {filteredApplications.length > 0 && (
                            <Pagination
                              currentPage={currentPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentPage}
                              itemsPerPage={itemsPerPage}
                              totalItems={filteredApplications.length}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Status Pipeline Tab */}
              {activeTab === 'pipeline' && (
                <div className="space-y-4">
                  {statusGroups.map(group => (
                    <div key={group.id} className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider px-2">
                        {group.label}
                      </h3>
                      {group.statuses
                        .filter(s => s.value !== 'all')
                        .map(status => {
const statusApps = (activeTab === 'pipeline' 
  ? allApplicationsForPipeline 
  : applications
).filter(app => app.status === status.value)
                          const isExpanded = expandedStatuses.includes(status.value)
                          
                          return (
                            <div key={status.value} className="bg-white rounded-lg border overflow-visible">
                              <button
                                onClick={() => toggleStatus(status.value)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-500" />
                                  )}
                                  <StatusBadge status={status.value} />
                                  <span className="font-medium text-gray-900">{status.label}</span>
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                                    {statusApps.length}
                                  </span>
                                </div>
                              </button>
                              
                              {isExpanded && statusApps.length > 0 && (
                                <div className="border-t overflow-visible">
                                  {statusApps.map(app => (
                                    <div key={app.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50 relative">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3 mb-2">
                                            <span className="font-mono text-sm text-blue-600 font-medium">
                                              {app.reference_number}
                                            </span>
                                            <h4 className="font-medium text-gray-900">{app.full_name}</h4>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                              <span className="text-gray-500">Position:</span>{' '}
                                              <span className="text-gray-900">{formatDisplayValue(app.desired_rank)}</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Vessel:</span>{' '}
                                              <span className="text-gray-900">{formatDisplayValue(app.vessel_type)}</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Email:</span>{' '}
                                              <span className="text-gray-900">{app.email}</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Phone:</span>{' '}
                                              <span className="text-gray-900">{app.phone}</span>
                                            </div>
                                          </div>
                                                    {app.llmAnalysis && (
              <div className="mt-4 px-4 py-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">🧠 AI Match Analysis</h4>
                <ConfidenceBadge llmAnalysis={app.llmAnalysis} compact={false} />
              </div>
            )}
                                        </div>
                                        <div className="flex items-center gap-2 ml-4 relative z-10">
<SequentialStatusControl
  applicationId={app.id}
  currentStatus={app.status}
  onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
  application={app}
  autoOpenInterview={autoOpenInterviewForApp === app.id}
    onAutoOpenComplete={() => setAutoOpenInterviewForApp(null)}  // ← ADD THIS
/>
                                          <button
                                            onClick={() => navigate(`/application/view/${app.public_token || app.id}`)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="View application"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* --- ADD MODALS AT THE END --- */}
      <RejectionModal
        isOpen={isRejectionModalOpen}
        onClose={() => setIsRejectionModalOpen(false)}
        applicant={selectedApplication}
        onConfirm={handleRejectConfirm}
      />

    </div>
  )
}
