import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  XCircle,
  Award,
  Menu,
  X as XIcon
} from 'lucide-react'

export default function RecruiterApplications() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canViewApplications, loading: permLoading } = usePermissions(user)
  
  const [applications, setApplications] = useState([])
  const [filteredApplications, setFilteredApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filters, setFilters] = useState({})
  
  // Tab management
  const [activeTab, setActiveTab] = useState('all')
  
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

  const [compoundQueryType, setCompoundQueryType] = useState(null)

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
      id: 'testing',
      label: 'Testing',
      icon: Clock,
      statuses: [
        { value: 'test_scheduled', label: 'Test Scheduled', count: 0 },
        { value: 'test_completed', label: 'Test Completed', count: 0 },
        { value: 'test_passed', label: 'Test Passed', count: 0 },
        { value: 'test_failed', label: 'Test Failed', count: 0 },
      ]
    },
    {
      id: 'interview',
      label: 'Interview',
      icon: Users,
      statuses: [
        { value: 'interview_scheduled', label: 'Interview Scheduled', count: 0 },
        { value: 'interview_completed', label: 'Interview Completed', count: 0 },
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
    }
  }, [permLoading])

  useEffect(() => {
    filterApplications()
  }, [applications, searchTerm, statusFilter])
  
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
          application_data (
            data
          )
        `)
        .not('submitted_at', 'is', null)

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

      if (appsError) {
        console.error('Applications error:', appsError)
        throw appsError
      }

      if (!appsData || appsData.length === 0) {
        setApplications([])
        return
      }

      const applicantIds = [...new Set(appsData.map(app => app.user_id))]
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', applicantIds)

      if (profilesError) {
        console.error('Profiles error:', profilesError)
        throw profilesError
      }

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
        formattedData = formattedData.filter(app => 
          app.nationality === appliedFilters.nationality
        )
      }

      if (appliedFilters.vesselType) {
        formattedData = formattedData.filter(app => 
          app.vessel_type === appliedFilters.vesselType
        )
      }

      if (appliedFilters.experienceRange) {
        formattedData = formattedData.filter(app => 
          matchesExperienceFilter(app.experience_years, appliedFilters.experienceRange)
        )
      }

      if (appliedFilters.ageRange) {
        formattedData = formattedData.filter(app => 
          app.age !== null && matchesAgeRange(app.age, appliedFilters.ageRange)
        )
      }

      if (appliedFilters.availability) {
        formattedData = formattedData.filter(app => 
          app.available_from && matchesAvailability(app.available_from, appliedFilters.availability)
        )
      }

      setApplications(formattedData)
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
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

    setFilteredApplications(filtered)
  }

  const getStatusCounts = () => {
    const counts = {
      all: applications.length,
      new: 0,
      under_review: 0,
      test_scheduled: 0,
      test_completed: 0,
      test_passed: 0,
      test_failed: 0,
      interview_scheduled: 0,
      interview_completed: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0
    }

    applications.forEach(app => {
      if (counts.hasOwnProperty(app.status)) {
        counts[app.status]++
      }
    })

    return counts
  }

  const handleStatusChange = (applicationId, newStatus) => {
    setApplications(prev =>
      prev.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    )
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
  }

  const handleApplyFilters = (filtersToApply = null) => {
    const activeFilters = filtersToApply || filters
    loadApplications(activeFilters)
  }

  const handleAISearchResults = (results, query) => {
    setAiSearchResults(results)
    setAiSearchQuery(query)
    setAiSearchActive(true)
    setFilteredApplications(results)
  }

  const handleClearAISearch = () => {
    setAiSearchActive(false)
    setAiSearchResults([])
    setAiSearchQuery('')
    filterApplications()
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
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return data.slice(startIndex, endIndex)
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

  const ApplicationTable = ({ apps, showRelevance = false }) => (
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Relevance
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 overflow-visible">
            {apps.length === 0 ? (
              <tr>
                <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
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
                    <div className="text-sm text-gray-900">{formatDisplayValue(app.vessel_type)}</div>
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
                  )}
                  <td className="px-6 py-4 relative">
                    <div className="flex items-center gap-2 relative z-10">
                      <SequentialStatusControl
                        applicationId={app.id}
                        currentStatus={app.status}
                        onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
                      />
                      <button
                        onClick={() => navigate(`/application/view/${app.public_token || app.id}`)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View application"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

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
            ) - (statusCounts.all || 0) // Don't double count "all"

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
                        onClick={() => setStatusFilter(status.value)}
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
                setActiveTab('all')
                setCurrentPage(1)
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
                setActiveTab('search')
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
                setActiveTab('pipeline')
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''} found
              </p>

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

                  {searchMode === 'ai' && (
                    <>
                      <AISearch 
                        onResults={handleAISearchResults}
                        onLoading={setLoading}
                        onClearSearch={handleClearAISearch}
                      />
                      {aiSearchActive && (
                        <>
                          <ApplicationTable apps={paginatedApplications} showRelevance={true} />
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
                          const statusApps = applications.filter(app => app.status === status.value)
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
                                        </div>
                                        <div className="flex items-center gap-2 ml-4 relative z-10">
                                          <SequentialStatusControl
                                            applicationId={app.id}
                                            currentStatus={app.status}
                                            onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
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
    </div>
  )
}